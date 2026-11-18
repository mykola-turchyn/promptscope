import { providerForModel } from '@promptscope/shared/providers';
import { isPassRateScorer } from '@promptscope/shared/scorers';
import { data, Form, redirect, useSearchParams } from 'react-router';
import { z } from 'zod';
import { projectContext, requireEditor, sessionContext } from '~/.server/context';
import { versionFormSchema } from '~/.server/prompt-form';
import {
  createPromptVersion,
  findPrompt,
  getPromptVersions,
  latestRunsByVersion,
  listPrompts,
  setLabel,
  versionUsage,
} from '~/.server/queries/prompts';
import { PageBody } from '~/components/layout/AppShell';
import {
  ModelSettings,
  PromoteButton,
  PromptNav,
  TemplateLines,
  Variables,
  VersionMetrics,
  VersionsList,
} from '~/components/prompts/PromptParts';
import { TemplateForm } from '~/components/prompts/TemplateForm';
import { Badge } from '~/components/ui/Badge';
import { ButtonLink } from '~/components/ui/Button';
import { Card } from '~/components/ui/Card';
import { Tabs } from '~/components/ui/Tabs';
import { diffLines, diffStats } from '~/lib/diff';
import { formatCost, formatCount, formatDay, formatDuration } from '~/lib/format';
import { projectPath } from '~/lib/paths';
import { defineHandle } from '~/lib/route-handle';
import { useTimeZone } from '~/lib/time-zone';
import type { Route } from './+types/prompt';

const HTTP_NOT_FOUND = 404;
const HTTP_BAD_REQUEST = 400;
const VIEWS = ['template', 'diff', 'edit'] as const;
type View = (typeof VIEWS)[number];

export const handle = defineHandle<{ prompt: { name: string } }>({
  breadcrumb: (loaderData) => loaderData.prompt.name,
});

export const meta: Route.MetaFunction = ({ params }) => [
  { title: `${params.name} · Prompts · Promptscope` },
];

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const { project, canEdit } = context.get(projectContext);
  const prompt = await findPrompt(project.id, params.name);
  if (!prompt) throw data('Prompt not found', { status: HTTP_NOT_FOUND });
  const [prompts, versions] = await Promise.all([
    listPrompts(project.id),
    getPromptVersions(prompt.id),
  ]);
  const searchParams = new URL(request.url).searchParams;
  const selected =
    versions.find(({ version }) => version === Number(searchParams.get('v'))) ?? versions[0];
  if (!selected) throw data('This prompt has no versions', { status: HTTP_NOT_FOUND });
  const previous = versions.find(({ version }) => version < selected.version) ?? null;
  const production = versions.find(({ labels }) => labels.includes('production')) ?? null;
  const staging = versions.find(({ labels }) => labels.includes('staging')) ?? null;
  const ids = [selected.id, ...(production ? [production.id] : [])];
  const [usage, runs] = await Promise.all([
    versionUsage(project.id, ids),
    latestRunsByVersion(project.id, ids),
  ]);
  const viewParam = searchParams.get('view') as View | null;
  const view: View =
    viewParam && VIEWS.includes(viewParam) ? viewParam : previous ? 'diff' : 'template';

  const productionRun = production
    ? runs.find((run) => run.promptVersionId === production.id)
    : undefined;
  const selectedRun = runs.find(
    (run) =>
      run.promptVersionId === selected.id &&
      (!productionRun || run.datasetId === productionRun.datasetId),
  );
  const judge = productionRun?.scorers.find((scorer) => !isPassRateScorer(scorer.kind));
  const productionUsage = production ? usage.get(production.id) : undefined;

  return {
    prompt: { name: prompt.name },
    prompts,
    versions,
    selected,
    previous,
    production: production ? { id: production.id, version: production.version } : null,
    staging: staging ? { version: staging.version } : null,
    productionUsage: productionUsage ?? null,
    productionScore:
      judge && productionRun?.summary ? (productionRun.summary.scores[judge.name] ?? null) : null,
    compareQuery:
      productionRun && selectedRun && productionRun.id !== selectedRun.id
        ? `a=${productionRun.id}&b=${selectedRun.id}`
        : null,
    view,
    canEdit,
  };
}

const actionSchema = z.discriminatedUnion('intent', [
  z.object({ intent: z.literal('promote'), versionId: z.uuid() }),
  versionFormSchema.extend({ intent: z.literal('new-version'), baseVersionId: z.uuid() }),
]);

export async function action({ request, context, params }: Route.ActionArgs) {
  const { project } = requireEditor(context);
  const { user } = context.get(sessionContext);
  const prompt = await findPrompt(project.id, params.name);
  if (!prompt) throw data('Prompt not found', { status: HTTP_NOT_FOUND });
  const parsed = actionSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) {
    return data(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: HTTP_BAD_REQUEST },
    );
  }
  const versions = await getPromptVersions(prompt.id);

  if (parsed.data.intent === 'promote') {
    const { versionId } = parsed.data;
    const version = versions.find(({ id }) => id === versionId);
    if (!version) throw data('Version not found', { status: HTTP_NOT_FOUND });
    await setLabel(prompt.id, version.id, 'production');

    throw redirect(projectPath(params, `prompts/${params.name}?v=${version.version}`));
  }
  const { baseVersionId, template, model, note, label } = parsed.data;
  const base = versions.find(({ id }) => id === baseVersionId);
  if (!base) throw data('Version not found', { status: HTTP_NOT_FOUND });
  const created = await createPromptVersion({
    promptId: prompt.id,
    template,
    note,
    label,
    userId: user.id,
    modelConfig: { ...base.modelConfig, model, provider: providerForModel(model) },
  });

  throw redirect(projectPath(params, `prompts/${params.name}?v=${created?.version ?? ''}`));
}

export default function PromptDetail({ loaderData, actionData }: Route.ComponentProps) {
  const timeZone = useTimeZone();
  const [searchParams] = useSearchParams();
  const { selected, previous, production, staging, view } = loaderData;
  const lines = diffLines(
    view === 'diff' && previous ? previous.template : selected.template,
    selected.template,
  );
  const stats = diffStats(lines);
  const hrefWith = (changes: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) next.set(key, value);

    return `?${next}`;
  };
  const tabs = [
    { id: 'template', label: 'Template', to: hrefWith({ view: 'template' }) },
    ...(previous
      ? [
          {
            id: 'diff',
            label: `Diff v${previous.version} → v${selected.version}`,
            to: hrefWith({ view: 'diff' }),
          },
        ]
      : []),
    ...(loaderData.canEdit
      ? [{ id: 'edit', label: 'New version', to: hrefWith({ view: 'edit' }) }]
      : []),
  ];
  const isProduction = production?.id === selected.id;
  const usage = loaderData.productionUsage;

  return (
    <PageBody maxWidth={1320} className="flex-row flex-wrap items-start">
      <PromptNav
        prompts={loaderData.prompts}
        current={loaderData.prompt.name}
        canEdit={loaderData.canEdit}
      />
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <h1 className="m-0 font-mono text-2xl font-semibold tracking-[-0.02em]">
              {loaderData.prompt.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              {production && <Badge tone="success">production · v{production.version}</Badge>}
              {staging && <Badge tone="warning">staging · v{staging.version}</Badge>}
              <span className="text-xs text-subtle">
                Used in {formatCount(usage?.traces ?? 0)} traces this week
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink
              to={
                loaderData.compareQuery
                  ? `../../evals/compare?${loaderData.compareQuery}`
                  : '../../datasets'
              }
              relative="path"
            >
              {loaderData.compareQuery ? 'Compare in eval' : 'Run an eval'}
            </ButtonLink>
            {loaderData.canEdit && !isProduction && (
              <Form method="post">
                <input type="hidden" name="versionId" value={selected.id} />
                <PromoteButton version={selected.version} />
              </Form>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-4">
          <Card
            as="section"
            aria-label="Template"
            className="flex min-w-0 flex-[2_1_480px] flex-col"
          >
            <Tabs
              label="Template view"
              items={tabs}
              selected={view}
              aside={
                view === 'diff' ? (
                  <span className="ml-auto pb-2 text-xs text-subtle">
                    +{stats.added} {stats.added === 1 ? 'line' : 'lines'}, −{stats.removed}{' '}
                    {stats.removed === 1 ? 'line' : 'lines'}
                  </span>
                ) : null
              }
            />
            {view === 'edit' ? (
              <TemplateForm
                intent="new-version"
                defaults={{ template: selected.template, model: selected.modelConfig.model ?? '' }}
                cancelTo={hrefWith({ view: 'template' })}
                error={actionData?.error}
                baseVersionId={selected.id}
              />
            ) : (
              <>
                <TemplateLines lines={lines} />
                <Variables names={selected.variables} />
              </>
            )}
          </Card>
          <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-4">
            <VersionsList
              selected={selected.version}
              hrefFor={(version) => hrefWith({ v: String(version), view: 'diff' })}
              versions={loaderData.versions.map((version) => ({
                id: version.id,
                version: version.version,
                note: version.note,
                labels: version.labels,
                meta: [version.author, formatDay(version.createdAt, timeZone)]
                  .filter(Boolean)
                  .join(' · '),
              }))}
            />
            <ModelSettings version={selected.version} config={selected.modelConfig} />
            {production && (
              <VersionMetrics
                title={`v${production.version} in production · 7 days`}
                metrics={{
                  avgScore:
                    loaderData.productionScore === null
                      ? '—'
                      : `${loaderData.productionScore.toFixed(1)} / 5`,
                  avgCost: usage ? formatCost(usage.avgCost) : '—',
                  p95: formatDuration(usage?.p95),
                }}
              />
            )}
          </div>
        </div>
      </div>
    </PageBody>
  );
}

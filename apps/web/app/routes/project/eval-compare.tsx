import { SCORER_SCALE } from '@promptscope/shared/scorers';
import { data, Form, redirect, useSearchParams } from 'react-router';
import { z } from 'zod';
import { projectContext, requireEditor, sessionContext } from '~/.server/context';
import {
  compareItems,
  createEvalRun,
  EVAL_PAGE_SIZE,
  getRun,
  primaryScorer,
  type RunDetail,
} from '~/.server/queries/evals';
import { setLabel } from '~/.server/queries/prompts';
import { RegressionToggle, RunCard, ScorerBars, VerdictCard } from '~/components/evals/EvalParts';
import { PageBody } from '~/components/layout/AppShell';
import { PromoteButton } from '~/components/prompts/PromptParts';
import { Badge, type Tone } from '~/components/ui/Badge';
import { Button } from '~/components/ui/Button';
import { Card, SectionTitle } from '~/components/ui/Card';
import { Alert, PageHeading } from '~/components/ui/Misc';
import { Pagination } from '~/components/ui/Pagination';
import { Table, TableHead, Td, Th } from '~/components/ui/Table';
import { previewValue } from '~/lib/dataset-import';
import { formatCost, formatCount, formatDayTime, formatDuration } from '~/lib/format';
import { projectPath } from '~/lib/paths';
import { defineHandle } from '~/lib/route-handle';
import { useTimeZone } from '~/lib/time-zone';
import { buildVerdict, scorerRows } from '~/lib/verdict';
import type { Route } from './+types/eval-compare';

const HTTP_NOT_FOUND = 404;
const HTTP_BAD_REQUEST = 400;
const ACTIVE_STATUSES = new Set(['queued', 'running']);

type LoaderData = Awaited<ReturnType<typeof loader>>;

export const handle = defineHandle<LoaderData>({
  breadcrumb: (loaderData) => `v${loaderData.a.version} vs v${loaderData.b.version}`,
  live: (loaderData) => loaderData.running,
  liveBadge: false,
});

export const meta: Route.MetaFunction = () => [{ title: 'Eval comparison · Promptscope' }];

async function requireRun(projectId: string, runId: string | null): Promise<RunDetail> {
  const run = runId && z.uuid().safeParse(runId).success ? await getRun(projectId, runId) : null;
  if (!run) throw data('Eval run not found', { status: HTTP_NOT_FOUND });

  return run;
}

function runSummary(run: RunDetail) {
  return {
    id: run.run.id,
    promptId: run.promptId,
    promptVersionId: run.run.promptVersionId,
    title: `${run.promptName}@v${run.version}`,
    version: run.version,
    isProduction: run.labels.includes('production'),
    status: run.run.status,
    error: run.run.error,
    createdAt: run.run.createdAt,
    totalCost: run.run.totalCost,
    durationMs: run.run.summary?.durationMs ?? null,
    p95: run.run.summary?.latencyP95Ms ?? 0,
    scores: run.run.summary?.scores ?? {},
    done: run.done,
    itemCount: run.itemCount,
  };
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { project, canEdit } = context.get(projectContext);
  const searchParams = new URL(request.url).searchParams;
  const [runA, runB] = await Promise.all([
    requireRun(project.id, searchParams.get('a')),
    requireRun(project.id, searchParams.get('b')),
  ]);
  const scorer = primaryScorer(runB.run.scorers);
  const regressionsOnly = searchParams.get('regressions') === '1';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const items = await compareItems(runA.run.id, runB.run.id, scorer?.name ?? '', {
    regressionsOnly,
    page,
  });

  return {
    a: runSummary(runA),
    b: runSummary(runB),
    dataset: { name: runA.datasetName, itemCount: runA.itemCount },
    scorers: runB.run.scorers.map(({ name, kind }) => ({ name, kind })),
    primaryScorer: scorer?.name ?? null,
    items,
    regressionsOnly,
    page,
    pageSize: EVAL_PAGE_SIZE,
    canEdit,
    running: ACTIVE_STATUSES.has(runA.run.status) || ACTIVE_STATUSES.has(runB.run.status),
  };
}

const actionSchema = z.object({ intent: z.enum(['promote', 'rerun']), runId: z.uuid() });

export async function action({ request, context, params }: Route.ActionArgs) {
  const { project } = requireEditor(context);
  const { user } = context.get(sessionContext);
  const parsed = actionSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return data({ error: 'Invalid request' }, { status: HTTP_BAD_REQUEST });
  const run = await requireRun(project.id, parsed.data.runId);

  if (parsed.data.intent === 'promote') {
    await setLabel(run.promptId, run.run.promptVersionId, 'production');

    return { ok: true };
  }
  const created = await createEvalRun({
    projectId: project.id,
    datasetId: run.run.datasetId,
    promptVersionId: run.run.promptVersionId,
    scorers: run.run.scorers,
    costLimit: run.run.costLimit,
    userId: user.id,
  });
  const searchParams = new URL(request.url).searchParams;

  throw redirect(
    projectPath(params, `evals/compare?a=${searchParams.get('a') ?? run.run.id}&b=${created.id}`),
  );
}

function deltaTone(delta: number | null): Tone {
  if (delta === null || delta === 0) return 'neutral';

  return delta > 0 ? 'success' : 'danger';
}

function formatDelta(delta: number | null): string {
  if (delta === null) return '—';
  if (delta === 0) return '0';

  return delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;
}

export default function EvalCompare({ loaderData }: Route.ComponentProps) {
  const timeZone = useTimeZone();
  const [searchParams] = useSearchParams();
  const { a, b, dataset, items } = loaderData;
  const summaries = loaderData.scorers.map(({ name, kind }) => ({
    name,
    kind,
    a: a.scores[name] ?? 0,
    b: b.scores[name] ?? 0,
  }));
  const verdict = buildVerdict({
    candidateLabel: `v${b.version}`,
    scorers: summaries,
    cost: { a: a.totalCost, b: b.totalCost },
    p95: { a: a.p95, b: b.p95 },
  });
  const hrefWith = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }

    return `?${next}`;
  };
  const runMeta = (run: typeof a) =>
    `${formatDayTime(run.createdAt, timeZone)} · ${formatCost(run.totalCost)} · ${run.durationMs === null ? run.status : formatDuration(run.durationMs)}`;
  const firstRow = (loaderData.page - 1) * loaderData.pageSize + 1;
  const shown = loaderData.regressionsOnly
    ? `${items.regressionCount} regressions of ${formatCount(dataset.itemCount)}`
    : `showing ${items.items.length} of ${formatCount(items.total)}`;

  return (
    <PageBody maxWidth={1240}>
      <PageHeading
        title="Eval comparison"
        description={
          <>
            Dataset <span className="font-mono text-[13px]">{dataset.name}</span> ·{' '}
            {formatCount(dataset.itemCount)} items · {loaderData.scorers.length} scorers
          </>
        }
        actions={
          loaderData.canEdit && (
            <>
              <Form method="post">
                <input type="hidden" name="runId" value={b.id} />
                <Button type="submit" name="intent" value="rerun" disabled={loaderData.running}>
                  Re-run
                </Button>
              </Form>
              {!b.isProduction && (
                <Form method="post">
                  <input type="hidden" name="runId" value={b.id} />
                  <PromoteButton version={b.version} />
                </Form>
              )}
            </>
          )
        }
      />
      {loaderData.running && (
        <Alert tone="warning" title="Eval run in progress" live>
          {formatCount(Math.min(a.done, a.itemCount))} of {formatCount(a.itemCount)} items for v
          {a.version}, {formatCount(Math.min(b.done, b.itemCount))} of {formatCount(b.itemCount)}{' '}
          for v{b.version}. Results update by themselves.
        </Alert>
      )}
      {[a, b].map((run) =>
        run.error ? (
          <Alert key={run.id} tone="danger" title={`Run for v${run.version} ${run.status}`}>
            {run.error}
          </Alert>
        ) : null,
      )}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-4">
        <RunCard caption="Baseline · run A" title={a.title} meta={runMeta(a)} />
        <RunCard caption="Candidate · run B" title={b.title} meta={runMeta(b)} candidate />
        <VerdictCard verdict={verdict} />
      </div>
      <ScorerBars
        rows={scorerRows(summaries, (kind) => SCORER_SCALE[kind].label)}
        labels={{ a: `v${a.version}`, b: `v${b.version}` }}
      />
      <Card as="section" aria-label="Items" className="flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 px-[18px] py-3.5">
          <SectionTitle>
            Items <span className="font-normal text-subtle">· {shown}</span>
          </SectionTitle>
          <RegressionToggle
            active={loaderData.regressionsOnly}
            href={hrefWith({ regressions: loaderData.regressionsOnly ? null : '1', page: null })}
          />
        </div>
        <Table minWidth={820}>
          <TableHead>
            <Th>Input</Th>
            <Th>v{a.version} output</Th>
            <Th>v{b.version} output</Th>
            <Th align="right">v{a.version}</Th>
            <Th align="right">v{b.version}</Th>
            <Th align="right">Δ</Th>
          </TableHead>
          <tbody>
            {items.items.map((item) => {
              const delta =
                item.score_a === null || item.score_b === null
                  ? null
                  : Number((item.score_b - item.score_a).toFixed(1));

              return (
                <tr key={item.item_id} className="align-top">
                  <Td className="max-w-[260px]">{previewValue(item.input)}</Td>
                  <Td className="max-w-[240px] font-mono text-xs text-muted">
                    {previewValue(item.output_a)}
                  </Td>
                  <Td className="max-w-[240px] font-mono text-xs text-muted">
                    {previewValue(item.output_b)}
                  </Td>
                  <Td align="right">{item.score_a ?? '—'}</Td>
                  <Td align="right" className="font-semibold">
                    {item.score_b ?? '—'}
                  </Td>
                  <Td align="right">
                    <Badge tone={deltaTone(delta)} strong>
                      {formatDelta(delta)}
                    </Badge>
                  </Td>
                </tr>
              );
            })}
            {items.items.length === 0 && (
              <tr>
                <Td colSpan={6} className="py-10 text-center text-muted">
                  {loaderData.regressionsOnly ? 'No regressions. Nice.' : 'No results yet.'}
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
        {items.total > items.items.length && (
          <Pagination
            summary={`Showing ${firstRow}–${firstRow + items.items.length - 1} of ${formatCount(items.total)}`}
            previous={loaderData.page > 1 ? hrefWith({ page: String(loaderData.page - 1) }) : null}
            next={
              firstRow + items.items.length - 1 < items.total
                ? hrefWith({ page: String(loaderData.page + 1) })
                : null
            }
          />
        )}
      </Card>
      {loaderData.primaryScorer && (
        <p className="m-0 text-xs text-subtle">
          Item scores and Δ use the “{loaderData.primaryScorer}” scorer.
        </p>
      )}
    </PageBody>
  );
}

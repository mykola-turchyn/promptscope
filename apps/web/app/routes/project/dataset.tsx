import type { ScorerConfig } from '@promptscope/shared/scorers';
import { data, Link, redirect, useSearchParams } from 'react-router';
import { z } from 'zod';
import { projectContext, requireEditor, sessionContext } from '~/.server/context';
import {
  addDatasetItems,
  DATASET_PAGE_SIZE,
  findDataset,
  getDatasetPage,
  listDatasets,
} from '~/.server/queries/datasets';
import {
  createEvalRun,
  findPromptVersion,
  latestRuns,
  listPromptVersionOptions,
} from '~/.server/queries/evals';
import { AddItemDialog, ImportDialog, RunEvalDialog } from '~/components/datasets/DatasetDialogs';
import { PageBody } from '~/components/layout/AppShell';
import { Badge, type Tone } from '~/components/ui/Badge';
import { ButtonLink } from '~/components/ui/Button';
import { Card } from '~/components/ui/Card';
import { PageHeading } from '~/components/ui/Misc';
import { Pagination } from '~/components/ui/Pagination';
import { Table, TableHead, Td, Th } from '~/components/ui/Table';
import { cn } from '~/lib/cn';
import { asItemInput, parseCellValue, parseDatasetFile, previewValue } from '~/lib/dataset-import';
import { formatCount, formatDay, formatRelative } from '~/lib/format';
import { projectPath } from '~/lib/paths';
import { defineHandle } from '~/lib/route-handle';
import { useTimeZone } from '~/lib/time-zone';
import type { Route } from './+types/dataset';

const HTTP_NOT_FOUND = 404;
const HTTP_BAD_REQUEST = 400;
const MAX_IMPORT_BYTES = 5 * 1_048_576;
const RECENT_RUNS = 50;

const SOURCES: Record<string, { label: string; tone: Tone }> = {
  trace: { label: 'From trace', tone: 'accent' },
  manual: { label: 'Manual', tone: 'neutral' },
  import: { label: 'Import', tone: 'success' },
};

export const handle = defineHandle<{ dataset: { name: string } }>({
  breadcrumb: (loaderData) => loaderData.dataset.name,
});

export const meta: Route.MetaFunction = () => [{ title: 'Datasets · Promptscope' }];

async function requireDataset(projectId: string, datasetId: string) {
  const dataset = z.uuid().safeParse(datasetId).success
    ? await findDataset(projectId, datasetId)
    : null;
  if (!dataset) throw data('Dataset not found', { status: HTTP_NOT_FOUND });

  return dataset;
}

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const { project, canEdit } = context.get(projectContext);
  const dataset = await requireDataset(project.id, params.datasetId);
  const page = Math.max(1, Number(new URL(request.url).searchParams.get('page')) || 1);
  const [datasets, items, versions] = await Promise.all([
    listDatasets(project.id),
    getDatasetPage(dataset.id, page),
    listPromptVersionOptions(project.id),
  ]);
  const current = datasets.find(({ id }) => id === dataset.id);

  return {
    dataset,
    datasets,
    itemCount: current?.itemCount ?? 0,
    ...items,
    page,
    pageSize: DATASET_PAGE_SIZE,
    versions,
    canEdit,
    now: new Date(),
  };
}

const runEvalSchema = z.object({
  intent: z.literal('run-eval'),
  promptVersionId: z.uuid(),
  rubric: z.string().trim().min(1).max(2_000),
  judgeModel: z.string().trim().min(1).max(64),
  costLimit: z.coerce.number().positive().max(10_000),
  exactMatch: z.literal('on').optional(),
  validJson: z.literal('on').optional(),
});

function scorersFrom(input: z.infer<typeof runEvalSchema>): ScorerConfig[] {
  return [
    { name: 'Judge score', kind: 'llm_judge', rubric: input.rubric, model: input.judgeModel },
    ...(input.exactMatch ? [{ name: 'Exact match', kind: 'exact_match' as const }] : []),
    ...(input.validJson
      ? [{ name: 'Valid JSON', kind: 'json_schema' as const, schema: { type: 'object' } }]
      : []),
  ];
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const { project } = requireEditor(context);
  const { user } = context.get(sessionContext);
  const dataset = await requireDataset(project.id, params.datasetId);
  const form = await request.formData();
  const intent = form.get('intent');

  if (intent === 'add-item') {
    const input = parseCellValue(String(form.get('input') ?? ''));
    if (input === null) return data({ error: 'The input is empty.' }, { status: HTTP_BAD_REQUEST });
    await addDatasetItems(dataset.id, [
      {
        input: asItemInput(input),
        expected: parseCellValue(String(form.get('expected') ?? '')),
        source: 'manual',
      },
    ]);

    return { ok: true };
  }
  if (intent === 'import') {
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0)
      return data({ error: 'Choose a file.' }, { status: HTTP_BAD_REQUEST });
    if (file.size > MAX_IMPORT_BYTES)
      return data({ error: 'Files up to 5 MB.' }, { status: HTTP_BAD_REQUEST });
    const result = parseDatasetFile(file.name, await file.text());
    if (!result.ok) return data({ error: result.error }, { status: HTTP_BAD_REQUEST });
    await addDatasetItems(
      dataset.id,
      result.items.map((item) => ({ ...item, source: 'import' as const })),
    );

    return { ok: true };
  }
  const parsed = runEvalSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return data({ error: 'Check the run settings.' }, { status: HTTP_BAD_REQUEST });
  if (!(await findPromptVersion(project.id, parsed.data.promptVersionId))) {
    return data({ error: 'Prompt version not found.' }, { status: HTTP_NOT_FOUND });
  }
  const run = await createEvalRun({
    projectId: project.id,
    datasetId: dataset.id,
    promptVersionId: parsed.data.promptVersionId,
    scorers: scorersFrom(parsed.data),
    costLimit: parsed.data.costLimit,
    userId: user.id,
  });
  const baseline = (await latestRuns(project.id, RECENT_RUNS)).find(
    (candidate) => candidate.datasetId === dataset.id && candidate.id !== run.id,
  );

  throw redirect(projectPath(params, `evals/compare?a=${baseline?.id ?? run.id}&b=${run.id}`));
}

export default function Dataset({ loaderData }: Route.ComponentProps) {
  const timeZone = useTimeZone();
  const [searchParams] = useSearchParams();
  const { dataset, datasets, items, itemCount, page, pageSize, canEdit } = loaderData;
  const pageHref = (target: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(target));

    return `?${next}`;
  };
  const firstRow = (page - 1) * pageSize + 1;
  const lastRow = firstRow + items.length - 1;
  const lastRun = loaderData.lastRunAt
    ? ` · last run ${formatRelative(loaderData.lastRunAt, loaderData.now)}`
    : '';

  return (
    <PageBody maxWidth={1240}>
      <PageHeading
        title="Datasets"
        description="Inputs with expected outputs. Evals run a prompt version against a dataset."
        actions={
          canEdit && (
            <>
              <ImportDialog />
              <ButtonLink to="../new" relative="path" variant="primary" icon="plus">
                New dataset
              </ButtonLink>
            </>
          )
        }
      />
      <div className="flex flex-wrap items-start gap-5">
        <Card
          as="nav"
          aria-label="Datasets"
          className="flex max-w-[320px] flex-[1_1_260px] flex-col gap-0.5 p-1.5"
        >
          {datasets.map((item) => (
            <Link
              key={item.id}
              to={`../${item.id}`}
              relative="path"
              aria-current={item.id === dataset.id ? 'page' : undefined}
              className={cn(
                'flex flex-col gap-1 rounded-control px-3 py-2.5 text-fg no-underline',
                item.id === dataset.id && 'bg-accent-soft',
              )}
            >
              <span className="flex justify-between gap-2">
                <span className="font-mono text-[13px] font-medium">{item.name}</span>
                <span className="tabular text-xs text-subtle">{formatCount(item.itemCount)}</span>
              </span>
              <span className="text-xs text-muted">{item.description || 'No description'}</span>
            </Link>
          ))}
        </Card>
        <Card
          as="section"
          aria-labelledby="ds-title"
          className="flex min-w-0 flex-[999_1_560px] flex-col"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-[18px] py-4">
            <div className="flex flex-col gap-0.5">
              <h2 id="ds-title" className="m-0 font-mono text-base font-semibold">
                {dataset.name}
              </h2>
              <span className="text-[13px] text-muted">
                {formatCount(itemCount)} items · used by {loaderData.runCount} eval runs{lastRun}
              </span>
            </div>
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <AddItemDialog />
                <RunEvalDialog versions={loaderData.versions} />
              </div>
            )}
          </div>
          <Table minWidth={760} caption={`Items in ${dataset.name}`}>
            <TableHead>
              <Th>Input</Th>
              <Th>Expected</Th>
              <Th>Source</Th>
              <Th align="right">Added</Th>
            </TableHead>
            <tbody>
              {items.map((item) => {
                const source = SOURCES[item.source] ?? {
                  label: item.source,
                  tone: 'neutral' as const,
                };

                return (
                  <tr key={item.id} className="align-top">
                    <Td className="max-w-[360px]">{previewValue(item.input)}</Td>
                    <Td className="max-w-[280px] text-muted">{previewValue(item.expected)}</Td>
                    <Td className="whitespace-nowrap">
                      <Badge tone={source.tone} shape="chip">
                        {source.label}
                      </Badge>
                    </Td>
                    <Td align="right" className="whitespace-nowrap text-muted">
                      {formatDay(item.createdAt, timeZone)}
                    </Td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <Td colSpan={4} className="py-10 text-center text-muted">
                    No items yet. Add one, import a file or add traces from the trace page.
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
          <Pagination
            summary={
              itemCount === 0
                ? 'No items'
                : `Showing ${firstRow}–${lastRow} of ${formatCount(itemCount)}`
            }
            previous={page > 1 ? pageHref(page - 1) : null}
            next={lastRow < itemCount ? pageHref(page + 1) : null}
          />
        </Card>
      </div>
    </PageBody>
  );
}

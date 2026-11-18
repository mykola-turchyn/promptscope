import { data, Link } from 'react-router';
import { z } from 'zod';
import { projectContext, requireEditor, sessionContext } from '~/.server/context';
import { addDatasetItems, findDataset, listDatasets } from '~/.server/queries/datasets';
import { getTrace, rateTrace, traceBelongsToProject } from '~/.server/queries/trace-detail';
import { PageBody } from '~/components/layout/AppShell';
import { SPAN_TABS, SpanPanel, type SpanTab } from '~/components/traces/SpanPanel';
import { SpanWaterfall } from '~/components/traces/SpanWaterfall';
import { TraceActions } from '~/components/traces/TraceActions';
import { TraceStatusBadge } from '~/components/traces/TraceStatusBadge';
import { ButtonLink } from '~/components/ui/Button';
import { Card } from '~/components/ui/Card';
import { Icon } from '~/components/ui/Icon';
import { Alert } from '~/components/ui/Misc';
import { Stat } from '~/components/ui/Stat';
import { formatCost, formatDateTimeSeconds, formatDuration, formatTokens } from '~/lib/format';
import { defineHandle } from '~/lib/route-handle';
import { flattenSpanTree } from '~/lib/span-tree';
import { useTimeZone } from '~/lib/time-zone';
import type { Route } from './+types/trace';

const HTTP_NOT_FOUND = 404;
const HTTP_BAD_REQUEST = 400;

export const handle = defineHandle<{ trace: { id: string } }>({
  breadcrumb: (loaderData) => loaderData.trace.id,
});

export const meta: Route.MetaFunction = ({ params }) => [
  { title: `${params.traceId} · Promptscope` },
];

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const { project, canEdit } = context.get(projectContext);
  const { user } = context.get(sessionContext);
  const [detail, datasets] = await Promise.all([
    getTrace(project.id, params.traceId, user.id),
    listDatasets(project.id),
  ]);
  if (!detail) throw data('Trace not found', { status: HTTP_NOT_FOUND });
  const searchParams = new URL(request.url).searchParams;
  const tabParam = searchParams.get('tab');
  const tab: SpanTab = (SPAN_TABS as readonly string[]).includes(tabParam ?? '')
    ? (tabParam as SpanTab)
    : 'io';

  return {
    ...detail,
    tab,
    requestedSpan: searchParams.get('span'),
    canEdit,
    datasets: datasets.map(({ id, name }) => ({ id, name })),
  };
}

const actionSchema = z.discriminatedUnion('intent', [
  z.object({
    intent: z.literal('rate'),
    value: z.coerce.number().pipe(z.union([z.literal(0), z.literal(1)])),
  }),
  z.object({ intent: z.literal('add-to-dataset'), datasetId: z.uuid() }),
]);

export async function action({ request, context, params }: Route.ActionArgs) {
  const { project } = requireEditor(context);
  const { user } = context.get(sessionContext);
  const parsed = actionSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return data({ error: 'Invalid request' }, { status: HTTP_BAD_REQUEST });
  const trace = await traceBelongsToProject(project.id, params.traceId);
  if (!trace) throw data('Trace not found', { status: HTTP_NOT_FOUND });

  if (parsed.data.intent === 'rate') {
    await rateTrace(project.id, params.traceId, user.id, parsed.data.value);

    return { ok: true };
  }
  const dataset = await findDataset(project.id, parsed.data.datasetId);
  if (!dataset) return data({ error: 'Dataset not found' }, { status: HTTP_NOT_FOUND });
  await addDatasetItems(dataset.id, [
    {
      input: trace.input ?? {},
      expected: trace.output,
      source: 'trace',
      sourceTraceId: params.traceId,
    },
  ]);

  return { ok: true };
}

export default function TraceDetail({ loaderData }: Route.ComponentProps) {
  const timeZone = useTimeZone();
  const { trace, prompt, scores, tab, requestedSpan } = loaderData;
  const spans = flattenSpanTree(loaderData.spans);
  const failedSpan = spans.find((span) => span.status === 'error' && span.error);
  const selected =
    spans.find((span) => span.id === requestedSpan) ??
    failedSpan ??
    spans.find((span) => span.type === 'llm') ??
    spans[0];
  const traceStart = Math.min(
    trace.startedAt.getTime(),
    ...spans.map((span) => span.startedAt.getTime()),
  );
  const traceEnd = Math.max(
    trace.endedAt?.getTime() ?? traceStart,
    ...spans.map((span) => span.endedAt.getTime()),
  );

  return (
    <PageBody maxWidth={1320}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <ButtonLink to=".." relative="path" size="icon" aria-label="Back to traces">
              <Icon name="chevronLeft" />
            </ButtonLink>
            <h1 className="m-0 text-2xl font-semibold tracking-[-0.02em]">{trace.name}</h1>
            <TraceStatusBadge status={trace.status} latencyMs={trace.latencyMs} size="md" />
          </div>
          <span className="font-mono text-xs text-subtle">
            {trace.id} · {formatDateTimeSeconds(trace.startedAt, timeZone)} · {trace.environment}
          </span>
        </div>
        <TraceActions
          traceId={trace.id}
          rating={loaderData.myRating}
          datasets={loaderData.datasets}
          canEdit={loaderData.canEdit}
        />
      </div>
      <Card className="grid grid-cols-[repeat(auto-fit,minmax(min(130px,100%),1fr))] gap-4 px-[18px] py-4">
        <Stat label="Duration">{formatDuration(trace.latencyMs)}</Stat>
        <Stat label="Cost">{formatCost(trace.totalCost)}</Stat>
        <Stat label="Tokens in / out">
          {formatTokens(trace.totalTokensIn, trace.totalTokensOut)}
        </Stat>
        <Stat label="Spans">{trace.spanCount}</Stat>
        <Stat label="User" mono>
          {trace.userId ?? '—'}
        </Stat>
        <Stat label="Prompt" mono>
          {prompt ? (
            <Link
              to={`../../prompts/${prompt.name}`}
              relative="path"
              className="text-accent-text no-underline"
            >
              {prompt.name}@v{prompt.version}
            </Link>
          ) : (
            '—'
          )}
        </Stat>
      </Card>
      {failedSpan && (
        <Alert tone="danger" title={`${failedSpan.name} failed`}>
          {failedSpan.error}
        </Alert>
      )}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(480px,100%),1fr))] items-start gap-4">
        <SpanWaterfall
          spans={spans}
          selectedId={selected?.id ?? null}
          traceStart={traceStart}
          totalMs={traceEnd - traceStart}
        />
        {selected && (
          <SpanPanel
            span={selected}
            tab={tab}
            scores={scores.filter((score) => score.spanId === null || score.spanId === selected.id)}
          />
        )}
      </div>
    </PageBody>
  );
}

import { Link, useSearchParams, useSubmit } from 'react-router';
import { projectContext } from '~/.server/context';
import { env } from '~/.server/env';
import { activeKeyPrefix, getOverview, hasTraces } from '~/.server/queries/overview';
import { PageBody } from '~/components/layout/AppShell';
import { CostChart } from '~/components/overview/CostChart';
import { LatencyChart } from '~/components/overview/LatencyChart';
import { Quickstart } from '~/components/quickstart/Quickstart';
import { TraceStatusBadge } from '~/components/traces/TraceStatusBadge';
import { Card, SectionTitle } from '~/components/ui/Card';
import { Icon } from '~/components/ui/Icon';
import { PageHeading } from '~/components/ui/Misc';
import { MetricTile } from '~/components/ui/Stat';
import { Table, TableHead, Td, Th } from '~/components/ui/Table';
import { buildCostSeries } from '~/lib/charts';
import {
  formatCost,
  formatCount,
  formatDay,
  formatDayRange,
  formatDayTime,
  formatDuration,
  formatPercent,
  formatSignedPercent,
} from '~/lib/format';
import { parseRange, RANGES, type RangeKey } from '~/lib/ranges';
import { defineHandle } from '~/lib/route-handle';
import { requestTimeZone, useTimeZone } from '~/lib/time-zone';
import type { Route } from './+types/overview';

const PERCENT = 100;
const HOURS_FORMAT: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
};

export const handle = defineHandle<Awaited<ReturnType<typeof loader>>>({
  breadcrumb: (data) => (data.empty ? 'Get started' : 'Overview'),
  live: true,
  liveBadge: (data) => !data.empty,
  HeaderActions: ({ data }) => (data.empty ? null : <RangePicker />),
});

export const meta: Route.MetaFunction = () => [{ title: 'Overview · Promptscope' }];

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const { project, canEdit } = context.get(projectContext);
  if (!(await hasTraces(project.id))) {
    return {
      empty: true as const,
      keyPrefix: await activeKeyPrefix(project.id),
      ingestUrl: env.PUBLIC_INGEST_URL,
      docsUrl: env.PUBLIC_DOCS_URL,
      settingsPath: `/${params.org}/${params.project}/settings/keys`,
      canEdit,
    };
  }
  const range = parseRange(new URL(request.url).searchParams.get('range'));

  return {
    empty: false as const,
    projectName: project.name,
    range,
    overview: await getOverview(project.id, range, requestTimeZone(request)),
  };
}

function RangePicker() {
  const [searchParams] = useSearchParams();
  const submit = useSubmit();
  const range = searchParams.get('range') ?? '7d';

  return (
    <form method="get" className="relative inline-flex">
      <Icon
        name="calendar"
        size={15}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
      />
      <select
        name="range"
        aria-label="Time range"
        defaultValue={range}
        onChange={(event) => submit(event.currentTarget.form, { preventScrollReset: true })}
        className="h-9 appearance-none rounded-control border border-border bg-surface pr-3 pl-[33px] font-medium text-fg [font:inherit]"
      >
        {Object.entries(RANGES).map(([key, { label }]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </form>
  );
}

function changeCaption(current: number, previous: number, range: RangeKey): string {
  const period = RANGES[range].label.replace('Last ', 'previous ');
  if (previous === 0) return `No spend in the ${period}`;

  return `${formatSignedPercent(((current - previous) / previous) * PERCENT)} vs ${period}`;
}

export default function Overview({ loaderData, params }: Route.ComponentProps) {
  const timeZone = useTimeZone();
  if (loaderData.empty) return <Quickstart {...loaderData} />;

  const { overview, range, projectName } = loaderData;
  const { kpis } = overview;
  const days = overview.buckets.length;
  const errorRate = kpis.traces === 0 ? 0 : (kpis.errors / kpis.traces) * PERCENT;
  const axis = overview.buckets.map((bucket) => ({
    key: String(bucket.getTime()),
    label:
      overview.bucket === 'hour'
        ? new Intl.DateTimeFormat('en-US', { ...HOURS_FORMAT, timeZone }).format(bucket)
        : formatDay(bucket, timeZone),
  }));
  const unit = overview.bucket === 'hour' ? 'hour' : 'day';
  const tracesPath = `/${params.org}/${params.project}/traces`;

  return (
    <PageBody maxWidth={1240} className="gap-6">
      <PageHeading
        title="Overview"
        description={`${projectName} · production · ${formatDayRange(overview.window.from, overview.window.to, timeZone)}`}
      />
      <section
        aria-label="Key metrics"
        className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-4"
      >
        <MetricTile
          label="Total cost"
          value={formatCost(kpis.cost)}
          caption={changeCaption(kpis.cost, overview.previousCost, range)}
        />
        <MetricTile
          label="Traces"
          value={formatCount(kpis.traces)}
          caption={`${formatCount(kpis.traces / Math.max(1, days))} per ${unit} on average`}
        />
        <MetricTile
          label="p95 latency"
          value={formatDuration(kpis.p95)}
          caption={`p50 ${formatDuration(kpis.p50)}`}
        />
        <MetricTile
          label="Error rate"
          value={formatPercent(errorRate)}
          valueClassName={kpis.errors > 0 ? 'text-danger' : undefined}
          caption={`${formatCount(kpis.errors)} failed traces`}
        />
      </section>
      <section className="grid grid-cols-[repeat(auto-fit,minmax(min(440px,100%),1fr))] gap-4">
        <CostChart
          title={`Cost by model, per ${unit}`}
          data={buildCostSeries(overview.costRows, overview.buckets)}
          axis={axis}
        />
        <LatencyChart title={`Latency, per ${unit}`} points={overview.latency} axis={axis} />
      </section>
      <Card as="section" className="flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 px-[18px] py-4">
          <SectionTitle>Most expensive traces</SectionTitle>
          <Link to={tracesPath} className="text-[13px] font-medium text-accent-text no-underline">
            View all traces
          </Link>
        </div>
        <Table minWidth={720}>
          <TableHead bordered>
            <Th>Trace</Th>
            <Th>Status</Th>
            <Th>Model</Th>
            <Th align="right">Spans</Th>
            <Th align="right">Latency</Th>
            <Th align="right">Cost</Th>
          </TableHead>
          <tbody>
            {overview.top.map((trace) => (
              <tr key={trace.id}>
                <Td className="py-3">
                  <Link
                    to={`${tracesPath}/${trace.id}`}
                    className="flex flex-col gap-0.5 text-fg no-underline"
                  >
                    <span className="font-medium">{trace.name}</span>
                    <span className="font-mono text-xs text-subtle">
                      {trace.id} · {formatDayTime(trace.startedAt, timeZone)}
                    </span>
                  </Link>
                </Td>
                <Td className="py-3">
                  <TraceStatusBadge status={trace.status} latencyMs={trace.latencyMs} dot={false} />
                </Td>
                <Td className="py-3 font-mono text-xs text-muted">{trace.models[0] ?? '—'}</Td>
                <Td align="right" className="py-3">
                  {trace.spanCount}
                </Td>
                <Td align="right" className="py-3">
                  {formatDuration(trace.latencyMs)}
                </Td>
                <Td align="right" className="py-3 font-medium">
                  {formatCost(trace.totalCost)}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </PageBody>
  );
}

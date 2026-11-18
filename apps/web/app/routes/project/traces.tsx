import { Form, Link, useSearchParams, useSubmit } from 'react-router';
import { projectContext } from '~/.server/context';
import { decodeCursor } from '~/.server/cursor';
import { listTraces, TRACES_PAGE_SIZE, traceFilterOptions } from '~/.server/queries/traces';
import { PageBody } from '~/components/layout/AppShell';
import { TraceStatusBadge } from '~/components/traces/TraceStatusBadge';
import { Tag } from '~/components/ui/Badge';
import { ButtonLink, buttonVariants } from '~/components/ui/Button';
import { Card } from '~/components/ui/Card';
import { type FilterOption, FilterSelect } from '~/components/ui/Field';
import { Icon } from '~/components/ui/Icon';
import { PageHeading } from '~/components/ui/Misc';
import { Pagination } from '~/components/ui/Pagination';
import { Table, TableHead, Td, Th } from '~/components/ui/Table';
import { cn } from '~/lib/cn';
import { formatCost, formatCount, formatDuration, formatStarted, formatTokens } from '~/lib/format';
import { defineHandle } from '~/lib/route-handle';
import { useTimeZone } from '~/lib/time-zone';
import {
  clearFiltersHref,
  filterChips,
  parseTraceFilters,
  type TraceSort,
} from '~/lib/trace-filters';
import type { Route } from './+types/traces';

export const handle = defineHandle({ breadcrumb: 'Traces', live: true });

export const meta: Route.MetaFunction = () => [{ title: 'Traces · Promptscope' }];

const ANY = '';
const STATUS_OPTIONS: FilterOption[] = [
  { value: ANY, label: 'Any' },
  { value: 'ok', label: 'OK' },
  { value: 'slow', label: 'Slow' },
  { value: 'error', label: 'Error' },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const { project } = context.get(projectContext);
  const searchParams = new URL(request.url).searchParams;
  const filters = parseTraceFilters(searchParams);
  const pageIndex = Math.max(1, Number(searchParams.get('page')) || 1);
  const [page, options] = await Promise.all([
    listTraces(project.id, filters, {
      cursor: decodeCursor(searchParams.get('cursor')),
      direction: searchParams.get('dir') === 'prev' ? 'prev' : 'next',
      index: pageIndex,
    }),
    traceFilterOptions(project.id),
  ]);

  return { page, options, pageSize: TRACES_PAGE_SIZE, now: new Date() };
}

function pageHref(
  searchParams: URLSearchParams,
  cursor: string | null,
  direction: 'next' | 'prev',
  index: number,
) {
  if (!cursor) return null;
  const next = new URLSearchParams(searchParams);
  if (index <= 1) {
    next.delete('cursor');
    next.delete('dir');
    next.delete('page');
  } else {
    next.set('cursor', cursor);
    next.set('dir', direction);
    next.set('page', String(index));
  }

  return `?${next}`;
}

function SortHeader({ sort, label }: { sort: TraceSort; label: string }) {
  const [searchParams] = useSearchParams();
  const active = (searchParams.get('sort') ?? 'started') === sort;
  const next = new URLSearchParams(searchParams);
  for (const key of ['cursor', 'dir', 'page']) next.delete(key);
  next.set('sort', sort);

  return (
    <Th align="right" aria-sort={active ? 'descending' : undefined}>
      <Link
        to={`?${next}`}
        preventScrollReset
        className={cn('no-underline', active ? 'text-fg' : 'text-subtle')}
      >
        {label}
        {active && ' ↓'}
      </Link>
    </Th>
  );
}

export default function Traces({ loaderData }: Route.ComponentProps) {
  const { page, options, now, pageSize } = loaderData;
  const [searchParams] = useSearchParams();
  const submit = useSubmit();
  const timeZone = useTimeZone();
  const promptLabels = new Map(options.promptVersions.map(({ id, label }) => [id, label]));
  const chips = filterChips(searchParams, (key, value) =>
    key === 'prompt' ? (promptLabels.get(value) ?? value) : value,
  );
  const firstRow = (page.pageIndex - 1) * pageSize + 1;
  const lastRow = firstRow + page.rows.length - 1;
  const submitFilters = (form: HTMLFormElement | null) =>
    submit(form, { preventScrollReset: true, replace: true });
  const exportHref = `traces/export?${searchParams}`;
  const anyOption = { value: ANY, label: 'Any' };

  return (
    <PageBody maxWidth={1240}>
      <PageHeading
        title="Traces"
        description={`${formatCount(page.total)} traces${chips.length > 0 ? ' match the filters' : ''}`}
        actions={
          <a href={exportHref} download className={buttonVariants()}>
            <Icon name="download" size={15} />
            Export CSV
          </a>
        }
      />
      <Form
        method="get"
        replace
        preventScrollReset
        className="flex flex-wrap items-center gap-2"
        key={searchParams.toString()}
      >
        {searchParams.get('sort') && (
          <input type="hidden" name="sort" value={searchParams.get('sort') ?? ''} />
        )}
        {searchParams.get('env') && (
          <input type="hidden" name="env" value={searchParams.get('env') ?? ''} />
        )}
        <label className="flex h-9 flex-[1_1_280px] items-center gap-2 rounded-control border border-border bg-surface px-3 text-subtle">
          <Icon name="search" size={15} />
          <span className="sr-only">Search traces</span>
          <input
            type="search"
            name="q"
            defaultValue={searchParams.get('q') ?? ''}
            placeholder="Search by name, trace ID or user ID"
            className="min-w-0 flex-1 border-0 bg-transparent text-fg outline-none [font:inherit]"
          />
        </label>
        <FilterSelect
          name="status"
          label="Status"
          options={STATUS_OPTIONS}
          defaultValue={searchParams.get('status') ?? ANY}
          onChange={(event) => submitFilters(event.currentTarget.form)}
        />
        <FilterSelect
          name="model"
          label="Model"
          options={[anyOption, ...options.models.map((model) => ({ value: model, label: model }))]}
          defaultValue={searchParams.get('model') ?? ANY}
          onChange={(event) => submitFilters(event.currentTarget.form)}
        />
        <FilterSelect
          name="prompt"
          label="Prompt version"
          options={[
            anyOption,
            ...options.promptVersions.map(({ id, label }) => ({ value: id, label })),
          ]}
          defaultValue={searchParams.get('prompt') ?? ANY}
          onChange={(event) => submitFilters(event.currentTarget.form)}
        />
        <FilterSelect
          name="tag"
          label="Tags"
          options={[anyOption, ...options.tags.map((tag) => ({ value: tag, label: tag }))]}
          defaultValue={searchParams.get('tag') ?? ANY}
          onChange={(event) => submitFilters(event.currentTarget.form)}
        />
        <button type="submit" className="sr-only">
          Apply filters
        </button>
      </Form>
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-subtle">Active filters</span>
          {chips.map((chip) => (
            <Link
              key={chip.key}
              to={chip.removeHref}
              preventScrollReset
              aria-label={`Remove filter ${chip.label}`}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 text-xs text-fg no-underline"
            >
              <span className="font-mono">{chip.label}</span>
              <Icon name="close" size={12} strokeWidth={2.4} />
            </Link>
          ))}
          <ButtonLink
            to={clearFiltersHref(searchParams)}
            variant="ghost"
            className="h-7 px-1.5 text-xs"
          >
            Clear all
          </ButtonLink>
        </div>
      )}
      <Card as="section" className="flex flex-col">
        <Table minWidth={900} caption="Traces">
          <TableHead>
            <Th>Trace</Th>
            <Th>Status</Th>
            <Th>Model</Th>
            <Th>User</Th>
            <Th align="right">Tokens in / out</Th>
            <SortHeader sort="latency" label="Latency" />
            <SortHeader sort="cost" label="Cost" />
            <Th>Tags</Th>
            <SortHeader sort="started" label="Started" />
          </TableHead>
          <tbody>
            {page.rows.map((trace) => (
              <tr key={trace.id}>
                <Td>
                  <Link to={trace.id} className="flex flex-col gap-0.5 text-fg no-underline">
                    <span className="font-medium">{trace.name}</span>
                    <span className="font-mono text-xs text-subtle">{trace.id}</span>
                  </Link>
                </Td>
                <Td>
                  <TraceStatusBadge status={trace.status} latencyMs={trace.latencyMs} />
                </Td>
                <Td className="whitespace-nowrap font-mono text-xs text-muted">
                  {trace.models[0] ?? '—'}
                </Td>
                <Td className="font-mono text-xs text-muted">{trace.userId ?? '—'}</Td>
                <Td align="right" className="whitespace-nowrap">
                  {formatTokens(trace.totalTokensIn, trace.totalTokensOut)}
                </Td>
                <Td align="right">{formatDuration(trace.latencyMs)}</Td>
                <Td align="right" className="font-medium">
                  {formatCost(trace.totalCost)}
                </Td>
                <Td>{trace.tags[0] && <Tag>{trace.tags[0]}</Tag>}</Td>
                <Td align="right" className="whitespace-nowrap text-muted">
                  {formatStarted(trace.startedAt, now, timeZone)}
                </Td>
              </tr>
            ))}
            {page.rows.length === 0 && (
              <tr>
                <Td colSpan={9} className="py-10 text-center text-muted">
                  No traces match these filters.
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
        <Pagination
          summary={
            page.total === 0
              ? 'No traces'
              : `Showing ${formatCount(firstRow)}–${formatCount(lastRow)} of ${formatCount(page.total)}`
          }
          previous={pageHref(searchParams, page.prevCursor, 'prev', page.pageIndex - 1)}
          next={pageHref(searchParams, page.nextCursor, 'next', page.pageIndex + 1)}
        />
      </Card>
    </PageBody>
  );
}

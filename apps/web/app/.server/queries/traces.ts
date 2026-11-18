import { schema } from '@promptscope/db';
import { SLOW_TRACE_MS } from '@promptscope/shared/status';
import { and, arrayContains, asc, desc, eq, gte, ilike, or, type SQL, sql } from 'drizzle-orm';
import type { TraceFilters, TraceSort } from '~/lib/trace-filters';
import { type Cursor, encodeCursor } from '../cursor';
import { db } from '../db';

export const TRACES_PAGE_SIZE = 25;
export const EXPORT_LIMIT = 10_000;
const FILTER_OPTIONS_LIMIT = 50;
const FILTER_OPTIONS_DAYS = 30;
const MS_PER_DAY = 86_400_000;

const { traces } = schema;

const SORT_COLUMNS = {
  started: traces.startedAt,
  cost: traces.totalCost,
  latency: traces.latencyMs,
} as const;

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export function traceConditions(projectId: string, filters: TraceFilters): SQL[] {
  const conditions: SQL[] = [eq(traces.projectId, projectId)];
  if (filters.q) {
    const pattern = `%${escapeLike(filters.q)}%`;
    const search = or(
      ilike(traces.name, pattern),
      eq(traces.id, filters.q),
      eq(traces.userId, filters.q),
    );
    if (search) conditions.push(search);
  }
  if (filters.status === 'error') conditions.push(eq(traces.status, 'error'));
  if (filters.status === 'slow') {
    conditions.push(sql`${traces.status} <> 'error' and ${traces.latencyMs} >= ${SLOW_TRACE_MS}`);
  }
  if (filters.status === 'ok') {
    conditions.push(
      sql`${traces.status} <> 'error' and coalesce(${traces.latencyMs}, 0) < ${SLOW_TRACE_MS}`,
    );
  }
  if (filters.model) conditions.push(arrayContains(traces.models, [filters.model]));
  if (filters.prompt) conditions.push(eq(traces.promptVersionId, filters.prompt));
  if (filters.tag) conditions.push(arrayContains(traces.tags, [filters.tag]));
  if (filters.env) conditions.push(eq(traces.environment, filters.env));

  return conditions;
}

const listColumns = {
  id: traces.id,
  name: traces.name,
  status: traces.status,
  models: traces.models,
  userId: traces.userId,
  totalTokensIn: traces.totalTokensIn,
  totalTokensOut: traces.totalTokensOut,
  latencyMs: traces.latencyMs,
  totalCost: traces.totalCost,
  tags: traces.tags,
  startedAt: traces.startedAt,
};

interface SortableRow {
  startedAt: Date;
  totalCost: number;
  latencyMs: number | null;
}

function sortValue(row: SortableRow, sort: TraceSort): string {
  if (sort === 'started') return row.startedAt.toISOString();
  if (sort === 'cost') return String(row.totalCost);

  return String(row.latencyMs ?? 0);
}

function cursorCondition(sort: TraceSort, cursor: Cursor, direction: 'next' | 'prev'): SQL {
  const column = SORT_COLUMNS[sort];
  const value = sort === 'started' ? new Date(cursor.value) : Number(cursor.value);
  const comparison = direction === 'next' ? sql`<` : sql`>`;

  return sql`(coalesce(${column}, ${sort === 'started' ? sql`'epoch'::timestamptz` : sql`0`}), ${traces.id}) ${comparison} (${value}, ${cursor.id})`;
}

export async function listTraces(
  projectId: string,
  filters: TraceFilters,
  page: { cursor: Cursor | null; direction: 'next' | 'prev'; index: number },
) {
  const conditions = traceConditions(projectId, filters);
  const column = SORT_COLUMNS[filters.sort];
  const isPrev = page.direction === 'prev' && page.cursor !== null;
  const order = isPrev ? [asc(column), asc(traces.id)] : [desc(column), desc(traces.id)];
  const where = page.cursor
    ? and(...conditions, cursorCondition(filters.sort, page.cursor, page.direction))
    : and(...conditions);
  const [rows, [count]] = await Promise.all([
    db
      .select(listColumns)
      .from(traces)
      .where(where)
      .orderBy(...order)
      .limit(TRACES_PAGE_SIZE + 1),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(traces)
      .where(and(...conditions)),
  ]);
  const hasMore = rows.length > TRACES_PAGE_SIZE;
  const pageRows = rows.slice(0, TRACES_PAGE_SIZE);
  if (isPrev) pageRows.reverse();
  const first = pageRows[0];
  const last = pageRows.at(-1);
  const hasNext = isPrev ? true : hasMore;
  const hasPrev = isPrev ? hasMore : page.index > 1;

  return {
    rows: pageRows,
    total: count?.total ?? 0,
    pageIndex: page.index,
    nextCursor:
      hasNext && last ? encodeCursor({ value: sortValue(last, filters.sort), id: last.id }) : null,
    prevCursor:
      hasPrev && first
        ? encodeCursor({ value: sortValue(first, filters.sort), id: first.id })
        : null,
  };
}

export async function exportTraces(projectId: string, filters: TraceFilters) {
  return db
    .select(listColumns)
    .from(traces)
    .where(and(...traceConditions(projectId, filters)))
    .orderBy(desc(SORT_COLUMNS[filters.sort]), desc(traces.id))
    .limit(EXPORT_LIMIT);
}

export async function traceFilterOptions(projectId: string, now = new Date()) {
  const since = new Date(now.getTime() - FILTER_OPTIONS_DAYS * MS_PER_DAY);
  const recent = and(eq(traces.projectId, projectId), gte(traces.startedAt, since));
  const [models, tags, promptVersions] = await Promise.all([
    db
      .selectDistinct({ value: sql<string>`unnest(${traces.models})` })
      .from(traces)
      .where(recent)
      .limit(FILTER_OPTIONS_LIMIT),
    db
      .selectDistinct({ value: sql<string>`unnest(${traces.tags})` })
      .from(traces)
      .where(recent)
      .limit(FILTER_OPTIONS_LIMIT),
    db
      .select({
        id: schema.promptVersions.id,
        name: schema.prompts.name,
        version: schema.promptVersions.version,
      })
      .from(schema.promptVersions)
      .innerJoin(schema.prompts, eq(schema.prompts.id, schema.promptVersions.promptId))
      .where(eq(schema.prompts.projectId, projectId))
      .orderBy(asc(schema.prompts.name), desc(schema.promptVersions.version))
      .limit(FILTER_OPTIONS_LIMIT),
  ]);

  return {
    models: models.map(({ value }) => value).sort(),
    tags: tags.map(({ value }) => value).sort(),
    promptVersions: promptVersions.map(({ id, name, version }) => ({
      id,
      label: `${name}@v${version}`,
    })),
  };
}

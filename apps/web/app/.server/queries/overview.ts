import { schema } from '@promptscope/db';
import { and, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import { RANGES, type RangeKey } from '~/lib/ranges';
import { db } from '../db';
import { databaseTimeZone } from '../time-zone';

const TOP_TRACES_LIMIT = 5;
const P95 = 0.95;
const P50 = 0.5;

interface Window {
  from: Date;
  to: Date;
}

async function kpis(projectId: string, { from, to }: Window) {
  const [row] = await db
    .select({
      traces: sql<number>`count(*)::int`,
      cost: sql<number>`coalesce(sum(${schema.traces.totalCost}), 0)::float`,
      p95: sql<
        number | null
      >`percentile_cont(${P95}) within group (order by ${schema.traces.latencyMs})`,
      p50: sql<
        number | null
      >`percentile_cont(${P50}) within group (order by ${schema.traces.latencyMs})`,
      errors: sql<number>`count(*) filter (where ${schema.traces.status} = 'error')::int`,
    })
    .from(schema.traces)
    .where(
      and(
        eq(schema.traces.projectId, projectId),
        gte(schema.traces.startedAt, from),
        lt(schema.traces.startedAt, to),
      ),
    );

  return row ?? { traces: 0, cost: 0, p95: null, p50: null, errors: 0 };
}

async function bucketsFor(to: Date, bucket: 'hour' | 'day', count: number, timeZone: string) {
  const result = await db.execute<{ bucket: Date }>(sql`
    select generate_series(
      date_trunc(${bucket}, ${to}::timestamptz - ${`${count - 1} ${bucket}`}::interval, ${timeZone}),
      ${to}::timestamptz,
      ${`1 ${bucket}`}::interval
    ) as bucket
  `);

  return result.rows.map((row) => new Date(row.bucket));
}

async function costByModel(
  projectId: string,
  window: Window,
  bucket: 'hour' | 'day',
  timeZone: string,
) {
  const result = await db.execute<{ bucket: Date; model: string; cost: number }>(sql`
    select date_trunc(${bucket}, started_at, ${timeZone}) as bucket, model, sum(cost)::float as cost
    from spans
    where project_id = ${projectId}
      and started_at >= ${window.from} and started_at < ${window.to}
      and model is not null and cost is not null
    group by 1, 2
  `);

  return result.rows.map((row) => ({ ...row, bucket: new Date(row.bucket) }));
}

async function latencyByBucket(
  projectId: string,
  window: Window,
  bucket: 'hour' | 'day',
  timeZone: string,
) {
  const result = await db.execute<{ bucket: Date; p95: number; p50: number }>(sql`
    select
      date_trunc(${bucket}, started_at, ${timeZone}) as bucket,
      percentile_cont(${P95}) within group (order by latency_ms) as p95,
      percentile_cont(${P50}) within group (order by latency_ms) as p50
    from traces
    where project_id = ${projectId} and started_at >= ${window.from} and started_at < ${window.to}
    group by 1
  `);

  return new Map(result.rows.map((row) => [new Date(row.bucket).getTime(), row]));
}

async function topTraces(projectId: string, { from, to }: Window) {
  return db
    .select({
      id: schema.traces.id,
      name: schema.traces.name,
      startedAt: schema.traces.startedAt,
      status: schema.traces.status,
      latencyMs: schema.traces.latencyMs,
      models: schema.traces.models,
      spanCount: schema.traces.spanCount,
      totalCost: schema.traces.totalCost,
    })
    .from(schema.traces)
    .where(
      and(
        eq(schema.traces.projectId, projectId),
        gte(schema.traces.startedAt, from),
        lt(schema.traces.startedAt, to),
      ),
    )
    .orderBy(desc(schema.traces.totalCost))
    .limit(TOP_TRACES_LIMIT);
}

export async function hasTraces(projectId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.traces.id })
    .from(schema.traces)
    .where(eq(schema.traces.projectId, projectId))
    .limit(1);

  return Boolean(row);
}

export async function activeKeyPrefix(projectId: string): Promise<string | null> {
  const [key] = await db
    .select({ prefix: schema.apiKeys.prefix })
    .from(schema.apiKeys)
    .where(and(eq(schema.apiKeys.projectId, projectId), isNull(schema.apiKeys.revokedAt)))
    .orderBy(desc(schema.apiKeys.createdAt))
    .limit(1);

  return key?.prefix ?? null;
}

export async function getOverview(
  projectId: string,
  range: RangeKey,
  timeZone: string,
  now = new Date(),
) {
  const { bucket, buckets: count } = RANGES[range];
  const zone = await databaseTimeZone(timeZone);
  const buckets = await bucketsFor(now, bucket, count, zone);
  const from = buckets[0] ?? now;
  const length = now.getTime() - from.getTime();
  const current = { from, to: now };
  const previous = { from: new Date(from.getTime() - length), to: from };
  const [currentKpis, previousKpis, costRows, latency, top] = await Promise.all([
    kpis(projectId, current),
    kpis(projectId, previous),
    costByModel(projectId, current, bucket, zone),
    latencyByBucket(projectId, current, bucket, zone),
    topTraces(projectId, current),
  ]);

  return {
    window: current,
    bucket,
    kpis: currentKpis,
    previousCost: previousKpis.cost,
    buckets,
    costRows,
    latency: buckets.map((start) => {
      const row = latency.get(start.getTime());

      return { bucket: start, p95: row?.p95 ?? null, p50: row?.p50 ?? null };
    }),
    top,
  };
}

import { type Db, ensureSpanPartitions, monthStart, schema } from '@promptscope/db';
import type { IngestJob } from '@promptscope/shared';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { PriceBook } from '../prices.ts';
import { toBatchRows } from './transform.ts';

const ensuredMonths = new Set<string>();

async function ensurePartitionsFor(db: Db, startedAts: Date[]) {
  const missing = [...new Set(startedAts.map(monthStart))].filter(
    (month) => !ensuredMonths.has(month),
  );
  if (missing.length === 0) return;
  await ensureSpanPartitions(db, missing);
  for (const month of missing) ensuredMonths.add(month);
}

async function knownPromptVersions(db: Db, projectId: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await db
    .select({ id: schema.promptVersions.id })
    .from(schema.promptVersions)
    .innerJoin(schema.prompts, eq(schema.prompts.id, schema.promptVersions.promptId))
    .where(and(eq(schema.prompts.projectId, projectId), inArray(schema.promptVersions.id, ids)));

  return new Set(rows.map(({ id }) => id));
}

export async function writeBatch(db: Db, prices: PriceBook, job: IngestJob) {
  const { projectId } = job;
  const rows = toBatchRows(projectId, job.events, prices);
  await ensurePartitionsFor(
    db,
    rows.spans.map(({ startedAt }) => startedAt),
  );
  const validPromptVersions = await knownPromptVersions(db, projectId, rows.promptVersionIds);
  const traces = rows.traces.map((trace) => ({
    ...trace,
    promptVersionId:
      trace.promptVersionId && validPromptVersions.has(trace.promptVersionId)
        ? trace.promptVersionId
        : null,
  }));
  const { traces: traceTable, spans: spanTable, scores: scoreTable } = schema;

  await db.transaction(async (tx) => {
    if (traces.length > 0) {
      await tx
        .insert(traceTable)
        .values(traces)
        .onConflictDoUpdate({
          target: traceTable.id,
          set: {
            name: sql`excluded.name`,
            userId: sql`excluded.user_id`,
            sessionId: sql`excluded.session_id`,
            environment: sql`excluded.environment`,
            tags: sql`excluded.tags`,
            promptVersionId: sql`excluded.prompt_version_id`,
            input: sql`excluded.input`,
            output: sql`excluded.output`,
            metadata: sql`excluded.metadata`,
            status: sql`excluded.status`,
            startedAt: sql`excluded.started_at`,
            endedAt: sql`excluded.ended_at`,
          },
          setWhere: sql`${traceTable.projectId} = excluded.project_id`,
        });
    }
    if (rows.stubTraces.length > 0) {
      await tx.insert(traceTable).values(rows.stubTraces).onConflictDoNothing();
    }
    if (rows.spans.length > 0) {
      await tx
        .insert(spanTable)
        .values(rows.spans)
        .onConflictDoUpdate({
          target: [spanTable.id, spanTable.startedAt],
          set: {
            output: sql`excluded.output`,
            endedAt: sql`excluded.ended_at`,
            latencyMs: sql`excluded.latency_ms`,
            tokensIn: sql`excluded.tokens_in`,
            tokensOut: sql`excluded.tokens_out`,
            cost: sql`excluded.cost`,
            status: sql`excluded.status`,
            error: sql`excluded.error`,
          },
          setWhere: sql`${spanTable.projectId} = excluded.project_id`,
        });
    }
    if (rows.scores.length > 0) {
      await tx.insert(scoreTable).values(rows.scores).onConflictDoNothing();
    }
    if (rows.traceIds.length > 0) {
      await tx.execute(sql`
        update traces as t set
          total_cost = agg.cost,
          total_tokens_in = agg.tokens_in,
          total_tokens_out = agg.tokens_out,
          span_count = agg.span_count,
          models = agg.models,
          status = case when agg.has_error then 'error' else t.status end,
          ended_at = greatest(t.ended_at, agg.ended_at),
          latency_ms = (extract(epoch from greatest(t.ended_at, agg.ended_at) - t.started_at) * 1000)::int
        from (
          select
            trace_id,
            coalesce(sum(cost), 0) as cost,
            coalesce(sum(tokens_in), 0)::int as tokens_in,
            coalesce(sum(tokens_out), 0)::int as tokens_out,
            count(*)::int as span_count,
            (
              select coalesce(array_agg(model order by model_cost desc), '{}')
              from (
                select s.model, sum(coalesce(s.cost, 0)) as model_cost
                from spans s
                where s.project_id = ${projectId} and s.trace_id = spans.trace_id and s.model is not null
                group by s.model
              ) as by_model
            ) as models,
            bool_or(status = 'error') as has_error,
            max(ended_at) as ended_at
          from spans
          where project_id = ${projectId} and trace_id in ${rows.traceIds}
          group by trace_id
        ) as agg
        where t.id = agg.trace_id and t.project_id = ${projectId}
      `);
    }
  });

  return { traceIds: rows.traceIds, spanCount: rows.spans.length };
}

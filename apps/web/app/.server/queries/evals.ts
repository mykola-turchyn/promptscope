import { schema } from '@promptscope/db';
import type { ScorerConfig } from '@promptscope/shared/scorers';
import { isPassRateScorer } from '@promptscope/shared/scorers';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { evalQueue } from '../redis';

export const EVAL_PAGE_SIZE = 25;

export async function createEvalRun(input: {
  projectId: string;
  datasetId: string;
  promptVersionId: string;
  scorers: ScorerConfig[];
  costLimit: number | null;
  userId: string;
}) {
  const [run] = await db
    .insert(schema.evalRuns)
    .values({ ...input, createdBy: input.userId, status: 'queued' })
    .returning({ id: schema.evalRuns.id });
  if (!run) throw new Error('Could not create the eval run');
  await evalQueue.add(
    'run',
    { runId: run.id },
    { jobId: run.id, removeOnComplete: true, attempts: 1 },
  );

  return run;
}

export async function listPromptVersionOptions(projectId: string) {
  const rows = await db
    .select({
      id: schema.promptVersions.id,
      name: schema.prompts.name,
      version: schema.promptVersions.version,
      labels: schema.promptVersions.labels,
    })
    .from(schema.promptVersions)
    .innerJoin(schema.prompts, eq(schema.prompts.id, schema.promptVersions.promptId))
    .where(eq(schema.prompts.projectId, projectId))
    .orderBy(asc(schema.prompts.name), desc(schema.promptVersions.version));

  return rows.map(({ id, name, version, labels }) => ({
    id,
    label: `${name}@v${version}${labels.length > 0 ? ` · ${labels.join(', ')}` : ''}`,
  }));
}

export async function findPromptVersion(projectId: string, versionId: string) {
  const [row] = await db
    .select({ id: schema.promptVersions.id })
    .from(schema.promptVersions)
    .innerJoin(schema.prompts, eq(schema.prompts.id, schema.promptVersions.promptId))
    .where(and(eq(schema.prompts.projectId, projectId), eq(schema.promptVersions.id, versionId)));

  return row ?? null;
}

export async function latestRuns(projectId: string, limit: number) {
  return db
    .select({
      id: schema.evalRuns.id,
      datasetId: schema.evalRuns.datasetId,
      promptVersionId: schema.evalRuns.promptVersionId,
    })
    .from(schema.evalRuns)
    .where(eq(schema.evalRuns.projectId, projectId))
    .orderBy(desc(schema.evalRuns.createdAt))
    .limit(limit);
}

export async function getRun(projectId: string, runId: string) {
  const [row] = await db
    .select({
      run: schema.evalRuns,
      promptId: schema.prompts.id,
      promptName: schema.prompts.name,
      version: schema.promptVersions.version,
      labels: schema.promptVersions.labels,
      datasetName: schema.datasets.name,
      itemCount: sql<number>`(select count(*)::int from ${schema.datasetItems} where ${schema.datasetItems.datasetId} = ${schema.evalRuns.datasetId})`,
      done: sql<number>`(select count(*)::int from ${schema.evalResults} where ${schema.evalResults.runId} = ${schema.evalRuns.id})`,
    })
    .from(schema.evalRuns)
    .innerJoin(schema.promptVersions, eq(schema.promptVersions.id, schema.evalRuns.promptVersionId))
    .innerJoin(schema.prompts, eq(schema.prompts.id, schema.promptVersions.promptId))
    .innerJoin(schema.datasets, eq(schema.datasets.id, schema.evalRuns.datasetId))
    .where(and(eq(schema.evalRuns.projectId, projectId), eq(schema.evalRuns.id, runId)));

  return row ?? null;
}

export type RunDetail = NonNullable<Awaited<ReturnType<typeof getRun>>>;

export function primaryScorer(scorers: ScorerConfig[]): ScorerConfig | undefined {
  return scorers.find(({ kind }) => !isPassRateScorer(kind)) ?? scorers[0];
}

export async function compareItems(
  runA: string,
  runB: string,
  scorer: string,
  options: { regressionsOnly: boolean; page: number },
) {
  const a = sql`(ra.scores ->> ${scorer})::float`;
  const b = sql`(rb.scores ->> ${scorer})::float`;
  const regression = options.regressionsOnly ? sql`and ${b} < ${a}` : sql``;
  const result = await db.execute<{
    item_id: string;
    input: unknown;
    output_a: unknown;
    output_b: unknown;
    score_a: number | null;
    score_b: number | null;
    total: number;
  }>(sql`
    select
      i.id as item_id, i.input, ra.output as output_a, rb.output as output_b,
      ${a} as score_a, ${b} as score_b, count(*) over ()::int as total
    from ${schema.evalResults} ra
    join ${schema.evalResults} rb on rb.item_id = ra.item_id and rb.run_id = ${runB}
    join ${schema.datasetItems} i on i.id = ra.item_id
    where ra.run_id = ${runA} ${regression}
    order by i.created_at desc, i.id
    limit ${EVAL_PAGE_SIZE} offset ${(options.page - 1) * EVAL_PAGE_SIZE}
  `);
  const [regressions] = await db
    .execute<{ count: number }>(sql`
    select count(*)::int as count
    from ${schema.evalResults} ra
    join ${schema.evalResults} rb on rb.item_id = ra.item_id and rb.run_id = ${runB}
    where ra.run_id = ${runA} and ${b} < ${a}
  `)
    .then(({ rows }) => rows);

  return {
    items: result.rows,
    total: result.rows[0]?.total ?? 0,
    regressionCount: regressions?.count ?? 0,
  };
}

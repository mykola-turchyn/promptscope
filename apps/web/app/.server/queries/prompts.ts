import { schema } from '@promptscope/db';
import type { ModelConfig, PromptLabel } from '@promptscope/db/schema';
import { extractVariables } from '@promptscope/shared/templates';
import { and, asc, desc, eq, gte, inArray, max, sql } from 'drizzle-orm';
import { db } from '../db';

const METRICS_DAYS = 7;
const MS_PER_DAY = 86_400_000;
const P95 = 0.95;

const { prompts, promptVersions } = schema;

export async function listPrompts(projectId: string) {
  const rows = await db
    .select({
      name: prompts.name,
      latest: max(promptVersions.version),
      production: sql<
        number | null
      >`max(${promptVersions.version}) filter (where 'production' = any(${promptVersions.labels}))`,
    })
    .from(prompts)
    .leftJoin(promptVersions, eq(promptVersions.promptId, prompts.id))
    .where(eq(prompts.projectId, projectId))
    .groupBy(prompts.id, prompts.name)
    .orderBy(asc(prompts.name));

  return rows.map((row) => ({
    name: row.name,
    meta: row.production
      ? `v${row.production} · production`
      : `v${row.latest ?? 0} · no production version`,
  }));
}

export async function findPrompt(projectId: string, name: string) {
  const [prompt] = await db
    .select()
    .from(prompts)
    .where(and(eq(prompts.projectId, projectId), eq(prompts.name, name)));

  return prompt ?? null;
}

export async function getPromptVersions(promptId: string) {
  return db
    .select({
      id: promptVersions.id,
      version: promptVersions.version,
      template: promptVersions.template,
      variables: promptVersions.variables,
      labels: promptVersions.labels,
      modelConfig: promptVersions.modelConfig,
      note: promptVersions.note,
      createdAt: promptVersions.createdAt,
      author: schema.user.name,
    })
    .from(promptVersions)
    .leftJoin(schema.user, eq(schema.user.id, promptVersions.createdBy))
    .where(eq(promptVersions.promptId, promptId))
    .orderBy(desc(promptVersions.version));
}

export async function versionUsage(projectId: string, versionIds: string[], now = new Date()) {
  if (versionIds.length === 0)
    return new Map<string, { traces: number; avgCost: number; p95: number | null }>();
  const since = new Date(now.getTime() - METRICS_DAYS * MS_PER_DAY);
  const rows = await db
    .select({
      versionId: schema.traces.promptVersionId,
      traces: sql<number>`count(*)::int`,
      avgCost: sql<number>`coalesce(avg(${schema.traces.totalCost}), 0)::float`,
      p95: sql<
        number | null
      >`percentile_cont(${P95}) within group (order by ${schema.traces.latencyMs})`,
    })
    .from(schema.traces)
    .where(
      and(
        eq(schema.traces.projectId, projectId),
        inArray(schema.traces.promptVersionId, versionIds),
        gte(schema.traces.startedAt, since),
      ),
    )
    .groupBy(schema.traces.promptVersionId);

  return new Map(rows.map(({ versionId, ...usage }) => [versionId ?? '', usage]));
}

export async function latestRunsByVersion(projectId: string, versionIds: string[]) {
  if (versionIds.length === 0) return [];

  return db
    .select({
      id: schema.evalRuns.id,
      promptVersionId: schema.evalRuns.promptVersionId,
      datasetId: schema.evalRuns.datasetId,
      summary: schema.evalRuns.summary,
      scorers: schema.evalRuns.scorers,
      createdAt: schema.evalRuns.createdAt,
    })
    .from(schema.evalRuns)
    .where(
      and(
        eq(schema.evalRuns.projectId, projectId),
        inArray(schema.evalRuns.promptVersionId, versionIds),
        eq(schema.evalRuns.status, 'completed'),
      ),
    )
    .orderBy(desc(schema.evalRuns.createdAt));
}

export async function setLabel(promptId: string, versionId: string, label: PromptLabel) {
  await db.transaction(async (tx) => {
    await tx
      .update(promptVersions)
      .set({ labels: sql`array_remove(${promptVersions.labels}, ${label})` })
      .where(eq(promptVersions.promptId, promptId));
    const others =
      label === 'production'
        ? sql`array_remove(${promptVersions.labels}, 'staging')`
        : promptVersions.labels;
    await tx
      .update(promptVersions)
      .set({ labels: sql`array_append(${others}, ${label})` })
      .where(and(eq(promptVersions.promptId, promptId), eq(promptVersions.id, versionId)));
  });
}

export async function createPromptVersion(input: {
  promptId: string;
  template: string;
  note: string;
  modelConfig: ModelConfig;
  label: PromptLabel | null;
  userId: string;
}) {
  return db.transaction(async (tx) => {
    const [latest] = await tx
      .select({ version: max(promptVersions.version) })
      .from(promptVersions)
      .where(eq(promptVersions.promptId, input.promptId));
    if (input.label) {
      await tx
        .update(promptVersions)
        .set({ labels: sql`array_remove(${promptVersions.labels}, ${input.label})` })
        .where(eq(promptVersions.promptId, input.promptId));
    }
    const [created] = await tx
      .insert(promptVersions)
      .values({
        promptId: input.promptId,
        version: (latest?.version ?? 0) + 1,
        template: input.template,
        variables: extractVariables(input.template),
        modelConfig: input.modelConfig,
        labels: input.label ? [input.label] : [],
        note: input.note || null,
        createdBy: input.userId,
      })
      .returning({ version: promptVersions.version });

    return created;
  });
}

export async function createPrompt(projectId: string, name: string) {
  const [prompt] = await db
    .insert(prompts)
    .values({ projectId, name })
    .onConflictDoNothing()
    .returning({ id: prompts.id });

  return prompt ?? null;
}

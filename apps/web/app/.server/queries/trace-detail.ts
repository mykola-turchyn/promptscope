import { schema } from '@promptscope/db';
import { newId } from '@promptscope/shared/ids';
import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '../db';

export const USER_FEEDBACK_SCORE = 'user-feedback';

export async function getTrace(projectId: string, traceId: string, userId: string) {
  const [row] = await db
    .select({
      trace: schema.traces,
      promptName: schema.prompts.name,
      promptVersion: schema.promptVersions.version,
    })
    .from(schema.traces)
    .leftJoin(schema.promptVersions, eq(schema.promptVersions.id, schema.traces.promptVersionId))
    .leftJoin(schema.prompts, eq(schema.prompts.id, schema.promptVersions.promptId))
    .where(and(eq(schema.traces.projectId, projectId), eq(schema.traces.id, traceId)));
  if (!row) return null;

  const [spans, scores] = await Promise.all([
    db
      .select({
        id: schema.spans.id,
        parentId: schema.spans.parentId,
        name: schema.spans.name,
        type: schema.spans.type,
        model: schema.spans.model,
        input: schema.spans.input,
        output: schema.spans.output,
        metadata: schema.spans.metadata,
        tokensIn: schema.spans.tokensIn,
        tokensOut: schema.spans.tokensOut,
        cost: schema.spans.cost,
        startedAt: schema.spans.startedAt,
        endedAt: schema.spans.endedAt,
        latencyMs: schema.spans.latencyMs,
        status: schema.spans.status,
        error: schema.spans.error,
      })
      .from(schema.spans)
      .where(and(eq(schema.spans.projectId, projectId), eq(schema.spans.traceId, traceId)))
      .orderBy(asc(schema.spans.startedAt)),
    db
      .select({
        name: schema.scores.name,
        value: schema.scores.value,
        source: schema.scores.source,
        spanId: schema.scores.spanId,
        comment: schema.scores.comment,
        createdBy: schema.scores.createdBy,
      })
      .from(schema.scores)
      .where(and(eq(schema.scores.projectId, projectId), eq(schema.scores.traceId, traceId))),
  ]);
  const myRating = scores.find(
    (score) => score.name === USER_FEEDBACK_SCORE && score.createdBy === userId,
  );

  return {
    trace: row.trace,
    prompt:
      row.promptName && row.promptVersion !== null
        ? { name: row.promptName, version: row.promptVersion }
        : null,
    spans,
    scores,
    myRating: myRating ? myRating.value : null,
  };
}

export async function rateTrace(projectId: string, traceId: string, userId: string, value: number) {
  await db
    .insert(schema.scores)
    .values({
      id: newId('score'),
      projectId,
      traceId,
      name: USER_FEEDBACK_SCORE,
      value,
      source: 'user',
      createdBy: userId,
    })
    .onConflictDoUpdate({
      target: [schema.scores.traceId, schema.scores.name, schema.scores.createdBy],
      set: { value, createdAt: sql`now()` },
    });
}

export async function traceBelongsToProject(projectId: string, traceId: string) {
  const [row] = await db
    .select({ input: schema.traces.input, output: schema.traces.output })
    .from(schema.traces)
    .where(and(eq(schema.traces.projectId, projectId), eq(schema.traces.id, traceId)));

  return row ?? null;
}

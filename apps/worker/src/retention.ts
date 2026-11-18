import { type Db, dropSpanPartitionsBefore, schema } from '@promptscope/db';
import { and, eq, lt, max } from 'drizzle-orm';

const MS_PER_DAY = 86_400_000;

export async function applyRetention(db: Db, now = new Date()) {
  const projects = await db
    .select({ id: schema.projects.id, retentionDays: schema.projects.retentionDays })
    .from(schema.projects);
  for (const project of projects) {
    const cutoff = new Date(now.getTime() - project.retentionDays * MS_PER_DAY);
    await db
      .delete(schema.spans)
      .where(and(eq(schema.spans.projectId, project.id), lt(schema.spans.startedAt, cutoff)));
    await db
      .delete(schema.traces)
      .where(and(eq(schema.traces.projectId, project.id), lt(schema.traces.startedAt, cutoff)));
  }
  const [longest] = await db
    .select({ days: max(schema.projects.retentionDays) })
    .from(schema.projects);
  const partitionCutoff = new Date(now.getTime() - (longest?.days ?? 0) * MS_PER_DAY);

  return { droppedPartitions: await dropSpanPartitionsBefore(db, partitionCutoff) };
}

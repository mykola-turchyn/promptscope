import { schema } from '@promptscope/db';
import type { DatasetItemSource } from '@promptscope/db/schema';
import { and, asc, count, desc, eq, max } from 'drizzle-orm';
import { db } from '../db';

export const DATASET_PAGE_SIZE = 25;
const IMPORT_CHUNK_SIZE = 500;

export async function listDatasets(projectId: string) {
  return db
    .select({
      id: schema.datasets.id,
      name: schema.datasets.name,
      description: schema.datasets.description,
      itemCount: count(schema.datasetItems.id),
    })
    .from(schema.datasets)
    .leftJoin(schema.datasetItems, eq(schema.datasetItems.datasetId, schema.datasets.id))
    .where(eq(schema.datasets.projectId, projectId))
    .groupBy(schema.datasets.id)
    .orderBy(asc(schema.datasets.createdAt));
}

export async function findDataset(projectId: string, datasetId: string) {
  const [dataset] = await db
    .select()
    .from(schema.datasets)
    .where(and(eq(schema.datasets.projectId, projectId), eq(schema.datasets.id, datasetId)));

  return dataset ?? null;
}

export async function getDatasetPage(datasetId: string, page: number) {
  const [items, [runStats]] = await Promise.all([
    db
      .select()
      .from(schema.datasetItems)
      .where(eq(schema.datasetItems.datasetId, datasetId))
      .orderBy(desc(schema.datasetItems.createdAt), desc(schema.datasetItems.id))
      .limit(DATASET_PAGE_SIZE)
      .offset((page - 1) * DATASET_PAGE_SIZE),
    db
      .select({ runs: count(), lastRunAt: max(schema.evalRuns.createdAt) })
      .from(schema.evalRuns)
      .where(eq(schema.evalRuns.datasetId, datasetId)),
  ]);

  return { items, runCount: runStats?.runs ?? 0, lastRunAt: runStats?.lastRunAt ?? null };
}

export async function createDataset(projectId: string, name: string, description: string) {
  const [dataset] = await db
    .insert(schema.datasets)
    .values({ projectId, name, description })
    .onConflictDoNothing()
    .returning({ id: schema.datasets.id });

  return dataset ?? null;
}

export interface NewDatasetItem {
  input: unknown;
  expected: unknown;
  source: DatasetItemSource;
  sourceTraceId?: string | null;
}

export async function addDatasetItems(datasetId: string, items: NewDatasetItem[]) {
  for (let index = 0; index < items.length; index += IMPORT_CHUNK_SIZE) {
    const chunk = items.slice(index, index + IMPORT_CHUNK_SIZE);
    await db.insert(schema.datasetItems).values(
      chunk.map((item) => ({
        datasetId,
        input: item.input ?? null,
        expected: item.expected ?? null,
        source: item.source,
        sourceTraceId: item.sourceTraceId ?? null,
      })),
    );
  }
}

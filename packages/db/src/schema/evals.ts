import type { ScorerConfig } from '@promptscope/shared/scorers';
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth.ts';
import { createdAt, money, uuidV7 } from './columns.ts';
import { projects } from './projects.ts';
import { promptVersions } from './prompts.ts';

export const DATASET_ITEM_SOURCES = ['manual', 'trace', 'import'] as const;
export type DatasetItemSource = (typeof DATASET_ITEM_SOURCES)[number];

export const datasets = pgTable(
  'datasets',
  {
    id: uuidV7().primaryKey(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    description: text().notNull().default(''),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex().on(table.projectId, table.name)],
);

export const datasetItems = pgTable(
  'dataset_items',
  {
    id: uuidV7().primaryKey(),
    datasetId: uuid()
      .notNull()
      .references(() => datasets.id, { onDelete: 'cascade' }),
    input: jsonb().notNull(),
    expected: jsonb(),
    source: text().$type<DatasetItemSource>().notNull().default('manual'),
    sourceTraceId: text(),
    createdAt: createdAt(),
  },
  (table) => [index().on(table.datasetId, table.createdAt.desc())],
);

export const EVAL_RUN_STATUSES = ['queued', 'running', 'completed', 'failed', 'stopped'] as const;
export type EvalRunStatus = (typeof EVAL_RUN_STATUSES)[number];

export interface EvalRunSummary {
  itemCount: number;
  scores: Record<string, number>;
  latencyP95Ms: number;
  durationMs: number;
}

export const evalRuns = pgTable(
  'eval_runs',
  {
    id: uuidV7().primaryKey(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    datasetId: uuid()
      .notNull()
      .references(() => datasets.id, { onDelete: 'cascade' }),
    promptVersionId: uuid()
      .notNull()
      .references(() => promptVersions.id, { onDelete: 'cascade' }),
    scorers: jsonb().$type<ScorerConfig[]>().notNull(),
    status: text().$type<EvalRunStatus>().notNull().default('queued'),
    costLimit: money(),
    totalCost: money().notNull().default(0),
    summary: jsonb().$type<EvalRunSummary>(),
    error: text(),
    startedAt: timestamp({ withTimezone: true }),
    finishedAt: timestamp({ withTimezone: true }),
    createdBy: text().references(() => user.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (table) => [index().on(table.projectId, table.createdAt.desc()), index().on(table.datasetId)],
);

export const evalResults = pgTable(
  'eval_results',
  {
    id: uuidV7().primaryKey(),
    runId: uuid()
      .notNull()
      .references(() => evalRuns.id, { onDelete: 'cascade' }),
    itemId: uuid()
      .notNull()
      .references(() => datasetItems.id, { onDelete: 'cascade' }),
    output: jsonb(),
    scores: jsonb().$type<Record<string, number>>().notNull().default({}),
    cost: money().notNull().default(0),
    latencyMs: integer(),
    error: text(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex().on(table.runId, table.itemId)],
);

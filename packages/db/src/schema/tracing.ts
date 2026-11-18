import { sql } from 'drizzle-orm';
import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth.ts';
import { createdAt, money, uuidV7 } from './columns.ts';
import { projects } from './projects.ts';
import { promptVersions } from './prompts.ts';

export const traces = pgTable(
  'traces',
  {
    id: text().primaryKey(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    userId: text(),
    sessionId: text(),
    environment: text().notNull().default('production'),
    tags: text().array().notNull().default(sql`'{}'::text[]`),
    promptVersionId: uuid().references(() => promptVersions.id, { onDelete: 'set null' }),
    input: jsonb(),
    output: jsonb(),
    metadata: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    status: text().notNull().default('ok'),
    startedAt: timestamp({ withTimezone: true }).notNull(),
    endedAt: timestamp({ withTimezone: true }),
    latencyMs: integer(),
    totalCost: money().notNull().default(0),
    totalTokensIn: integer().notNull().default(0),
    totalTokensOut: integer().notNull().default(0),
    spanCount: integer().notNull().default(0),
    models: text().array().notNull().default(sql`'{}'::text[]`),
    createdAt: createdAt(),
  },
  (table) => [
    index().on(table.projectId, table.startedAt.desc()),
    index().on(table.projectId, table.totalCost.desc()),
    index().using('gin', table.tags),
  ],
);

// Partitioned by month on started_at (see the custom migration), so the key includes it.
export const spans = pgTable(
  'spans',
  {
    id: text().notNull(),
    traceId: text().notNull(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    parentId: text(),
    name: text().notNull(),
    type: text().notNull().default('custom'),
    model: text(),
    input: jsonb(),
    output: jsonb(),
    metadata: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    tokensIn: integer(),
    tokensOut: integer(),
    cost: money(),
    startedAt: timestamp({ withTimezone: true }).notNull(),
    endedAt: timestamp({ withTimezone: true }).notNull(),
    latencyMs: integer().notNull(),
    status: text().notNull().default('ok'),
    error: text(),
  },
  (table) => [
    primaryKey({ columns: [table.id, table.startedAt] }),
    index().on(table.traceId),
    index().on(table.projectId, table.startedAt.desc()),
  ],
);

export const SCORE_SOURCES = ['user', 'eval', 'api'] as const;
export type ScoreSource = (typeof SCORE_SOURCES)[number];

export const scores = pgTable(
  'scores',
  {
    id: text().primaryKey(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    traceId: text().notNull(),
    spanId: text(),
    name: text().notNull(),
    value: doublePrecision().notNull(),
    source: text().$type<ScoreSource>().notNull(),
    comment: text(),
    createdBy: text().references(() => user.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (table) => [
    index().on(table.traceId),
    uniqueIndex().on(table.traceId, table.name, table.createdBy),
  ],
);

export const modelPrices = pgTable(
  'model_prices',
  {
    id: uuidV7().primaryKey(),
    provider: text().notNull(),
    model: text().notNull(),
    inputPer1m: money().notNull(),
    outputPer1m: money().notNull(),
    validFrom: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [uniqueIndex().on(table.model, table.validFrom)],
);

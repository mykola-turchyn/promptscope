import type { PromptLabel } from '@promptscope/shared/prompts';
import { sql } from 'drizzle-orm';
import { integer, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { user } from './auth.ts';
import { createdAt, uuidV7 } from './columns.ts';
import { projects } from './projects.ts';

export { PROMPT_LABELS, type PromptLabel } from '@promptscope/shared/prompts';

export interface ModelConfig {
  provider?: 'openai' | 'anthropic';
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: string[];
}

export const prompts = pgTable(
  'prompts',
  {
    id: uuidV7().primaryKey(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex().on(table.projectId, table.name)],
);

export const promptVersions = pgTable(
  'prompt_versions',
  {
    id: uuidV7().primaryKey(),
    promptId: uuid()
      .notNull()
      .references(() => prompts.id, { onDelete: 'cascade' }),
    version: integer().notNull(),
    template: text().notNull(),
    variables: text().array().notNull().default(sql`'{}'::text[]`),
    modelConfig: jsonb().$type<ModelConfig>().notNull().default({}),
    labels: text().array().$type<PromptLabel[]>().notNull().default(sql`'{}'::text[]`),
    note: text(),
    createdBy: text().references(() => user.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex().on(table.promptId, table.version)],
);

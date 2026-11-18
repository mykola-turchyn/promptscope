import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { organization, user } from './auth.ts';
import { createdAt, uuidV7 } from './columns.ts';

export const DEFAULT_RETENTION_DAYS = 90;

export const projects = pgTable(
  'projects',
  {
    id: uuidV7().primaryKey(),
    orgId: text()
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    slug: text().notNull(),
    name: text().notNull(),
    retentionDays: integer().notNull().default(DEFAULT_RETENTION_DAYS),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex().on(table.orgId, table.slug)],
);

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuidV7().primaryKey(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    keyHash: text().notNull().unique(),
    prefix: text().notNull(),
    createdBy: text().references(() => user.id, { onDelete: 'set null' }),
    lastUsedAt: timestamp({ withTimezone: true }),
    revokedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [index().on(table.projectId)],
);

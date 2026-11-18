import { sql } from 'drizzle-orm';
import { numeric, timestamp, uuid } from 'drizzle-orm/pg-core';

export const uuidV7 = () => uuid().default(sql`uuidv7()`);

export const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();

export const money = () => numeric({ precision: 16, scale: 8, mode: 'number' });

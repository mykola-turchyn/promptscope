import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from '../src/client.ts';
import { requireEnv } from './env.ts';

const { db, close } = createDb(requireEnv('DATABASE_URL'), 1);
await migrate(db, {
  migrationsFolder: process.env.MIGRATIONS_DIR ?? new URL('../drizzle', import.meta.url).pathname,
});
await close();
console.log('Migrations applied');

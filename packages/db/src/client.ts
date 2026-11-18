import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index.ts';

const DEFAULT_POOL_SIZE = 10;

export function createDb(connectionString: string, poolSize = DEFAULT_POOL_SIZE) {
  const pool = new pg.Pool({ connectionString, max: poolSize });
  const db = drizzle({ client: pool, schema, casing: 'snake_case' });

  return { db, close: () => pool.end() };
}

export type Db = ReturnType<typeof createDb>['db'];
export type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DbOrTransaction = Db | Transaction;

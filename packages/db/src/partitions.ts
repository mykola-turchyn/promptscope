import { sql } from 'drizzle-orm';
import type { DbOrTransaction } from './client.ts';

export function monthStart(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

export function monthsBetween(from: Date, to: Date): string[] {
  const months: string[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  while (cursor.getTime() <= to.getTime()) {
    months.push(monthStart(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return months;
}

export async function ensureSpanPartitions(db: DbOrTransaction, months: Iterable<string>) {
  for (const month of new Set(months)) {
    await db.execute(sql`select ensure_span_partition(${month}::date)`);
  }
}

export async function dropSpanPartitionsBefore(db: DbOrTransaction, cutoff: Date) {
  const result = await db.execute<{ dropped: number }>(
    sql`select drop_span_partitions_before(${monthStart(cutoff)}::date) as dropped`,
  );

  return result.rows[0]?.dropped ?? 0;
}

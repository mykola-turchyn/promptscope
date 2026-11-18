import { sql } from 'drizzle-orm';
import { DEFAULT_TIME_ZONE } from '~/lib/time-zone';
import { db } from './db';

// Browsers still report some legacy IANA names that Postgres no longer ships.
const LEGACY_NAMES: Record<string, string> = {
  'Europe/Kiev': 'Europe/Kyiv',
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Asia/Katmandu': 'Asia/Kathmandu',
};

let known: Promise<Set<string>> | undefined;

function postgresTimeZones(): Promise<Set<string>> {
  known ??= db
    .execute<{ name: string }>(sql`select name from pg_timezone_names`)
    .then(({ rows }) => new Set(rows.map(({ name }) => name)));

  return known;
}

export async function databaseTimeZone(timeZone: string): Promise<string> {
  const names = await postgresTimeZones();
  const candidate = LEGACY_NAMES[timeZone] ?? timeZone;

  return names.has(candidate) ? candidate : DEFAULT_TIME_ZONE;
}

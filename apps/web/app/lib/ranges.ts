export const RANGES = {
  '24h': { label: 'Last 24 hours', bucket: 'hour', buckets: 24 },
  '7d': { label: 'Last 7 days', bucket: 'day', buckets: 7 },
  '30d': { label: 'Last 30 days', bucket: 'day', buckets: 30 },
} as const;
export type RangeKey = keyof typeof RANGES;
export const DEFAULT_RANGE: RangeKey = '7d';

export function parseRange(value: string | null): RangeKey {
  return value && value in RANGES ? (value as RangeKey) : DEFAULT_RANGE;
}

import { TRACE_DISPLAY_STATUSES } from '@promptscope/shared/status';
import { z } from 'zod';

export const TRACE_SORTS = ['started', 'cost', 'latency'] as const;
export type TraceSort = (typeof TRACE_SORTS)[number];

const MAX_QUERY_LENGTH = 200;

const optionalText = z
  .string()
  .trim()
  .max(MAX_QUERY_LENGTH)
  .optional()
  .transform((value) => value || undefined);

export const traceFiltersSchema = z.object({
  q: optionalText,
  status: z.enum(TRACE_DISPLAY_STATUSES).optional().catch(undefined),
  model: optionalText,
  prompt: z.uuid().optional().catch(undefined),
  tag: optionalText,
  env: optionalText,
  sort: z.enum(TRACE_SORTS).default('started').catch('started'),
});

export type TraceFilters = z.infer<typeof traceFiltersSchema>;

export const FILTER_KEYS = ['q', 'status', 'model', 'prompt', 'tag', 'env'] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

const CHIP_LABELS: Record<FilterKey, string> = {
  q: 'search',
  status: 'status',
  model: 'model',
  prompt: 'prompt',
  tag: 'tag',
  env: 'env',
};

export function parseTraceFilters(searchParams: URLSearchParams): TraceFilters {
  return traceFiltersSchema.parse(Object.fromEntries(searchParams));
}

export interface FilterChip {
  key: FilterKey;
  label: string;
  removeHref: string;
}

export function filterChips(
  searchParams: URLSearchParams,
  describeValue: (key: FilterKey, value: string) => string = (_key, value) => value,
): FilterChip[] {
  return FILTER_KEYS.flatMap((key) => {
    const value = searchParams.get(key);
    if (!value) return [];
    const next = new URLSearchParams(searchParams);
    next.delete(key);
    next.delete('cursor');
    next.delete('dir');
    next.delete('page');

    return [
      { key, label: `${CHIP_LABELS[key]} = ${describeValue(key, value)}`, removeHref: `?${next}` },
    ];
  });
}

export function clearFiltersHref(searchParams: URLSearchParams): string {
  const next = new URLSearchParams();
  const sort = searchParams.get('sort');
  if (sort) next.set('sort', sort);

  return `?${next}`;
}

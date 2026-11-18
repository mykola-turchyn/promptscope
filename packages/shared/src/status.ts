export const SLOW_TRACE_MS = 10_000;

export const TRACE_DISPLAY_STATUSES = ['ok', 'slow', 'error'] as const;
export type TraceDisplayStatus = (typeof TRACE_DISPLAY_STATUSES)[number];

export function traceDisplayStatus(status: string, latencyMs: number | null): TraceDisplayStatus {
  if (status === 'error') return 'error';
  if ((latencyMs ?? 0) >= SLOW_TRACE_MS) return 'slow';

  return 'ok';
}

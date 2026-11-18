import type { EvalRunSummary } from '@promptscope/db/schema';

const P95 = 0.95;

export interface ResultForSummary {
  scores: Record<string, number>;
  latencyMs: number | null;
}

export function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1);

  return sorted[Math.max(0, index)] ?? 0;
}

export function summarize(
  scorerNames: string[],
  results: ResultForSummary[],
  durationMs: number,
): EvalRunSummary {
  const scores = Object.fromEntries(
    scorerNames.map((name) => {
      const values = results.flatMap((result) => {
        const value = result.scores[name];

        return value === undefined ? [] : [value];
      });
      const average =
        values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

      return [name, average];
    }),
  );
  const latencies = results.flatMap(({ latencyMs }) => (latencyMs === null ? [] : [latencyMs]));

  return {
    itemCount: results.length,
    scores,
    latencyP95Ms: percentile(latencies, P95),
    durationMs,
  };
}

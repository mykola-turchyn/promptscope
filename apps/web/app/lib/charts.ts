export const MAX_SERIES = 3;
export const OTHER_SERIES = 'Other models';

export interface CostRow {
  bucket: Date;
  model: string;
  cost: number;
}

export interface StackedBucket {
  bucket: Date;
  values: number[];
  total: number;
}

export interface CostSeries {
  series: string[];
  buckets: StackedBucket[];
  max: number;
}

// Charts use at most three series (design rule): the top models by cost, and when there are more,
// the top two plus everything else combined.
export function buildCostSeries(rows: CostRow[], buckets: Date[]): CostSeries {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.model, (totals.get(row.model) ?? 0) + row.cost);
  const ranked = [...totals.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([model]) => model);
  const series =
    ranked.length > MAX_SERIES ? [...ranked.slice(0, MAX_SERIES - 1), OTHER_SERIES] : ranked;
  const seriesIndex = (model: string) => {
    const index = series.indexOf(model);

    return index === -1 ? series.length - 1 : index;
  };
  const byBucket = new Map(
    buckets.map((bucket) => [bucket.getTime(), new Array<number>(series.length).fill(0)]),
  );
  for (const row of rows) {
    const values = byBucket.get(row.bucket.getTime());
    if (!values) continue;
    const index = seriesIndex(row.model);
    values[index] = (values[index] ?? 0) + row.cost;
  }
  const stacked = buckets.map((bucket) => {
    const values = byBucket.get(bucket.getTime()) ?? [];

    return { bucket, values, total: values.reduce((sum, value) => sum + value, 0) };
  });

  return { series, buckets: stacked, max: Math.max(0, ...stacked.map(({ total }) => total)) };
}

const NICE_STEPS = [1, 2, 2.5, 5, 10];

// Rounds a maximum up to a "nice" axis value (1, 2, 2.5 or 5 times a power of ten).
export function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = NICE_STEPS.find((candidate) => candidate * magnitude >= value) ?? 10;

  return step * magnitude;
}

export function linePoints(
  values: Array<number | null>,
  max: number,
  width: number,
  height: number,
): string {
  const step = width / Math.max(1, values.length);

  return values
    .flatMap((value, index) =>
      value === null
        ? []
        : [
            `${(step / 2 + index * step).toFixed(1)},${(height - (value / max) * height).toFixed(1)}`,
          ],
    )
    .join(' ');
}

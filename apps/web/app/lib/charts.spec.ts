import { describe, expect, it } from 'vitest';
import { buildCostSeries, linePoints, niceCeiling, OTHER_SERIES } from './charts';

const day = (value: string) => new Date(`2026-11-${value}T00:00:00Z`);

describe('buildCostSeries', () => {
  it('stacks cost per bucket in order of total cost, filling empty days', () => {
    const result = buildCostSeries(
      [
        { bucket: day('11'), model: 'gpt-4.1', cost: 2 },
        { bucket: day('11'), model: 'claude-sonnet-4-5', cost: 5 },
        { bucket: day('13'), model: 'claude-sonnet-4-5', cost: 1 },
      ],
      [day('11'), day('12'), day('13')],
    );

    expect(result.series).toEqual(['claude-sonnet-4-5', 'gpt-4.1']);
    expect(result.buckets.map(({ values }) => values)).toEqual([
      [5, 2],
      [0, 0],
      [1, 0],
    ]);
    expect(result.max).toBe(7);
  });

  it('folds models beyond the second into one series when there are more than three', () => {
    const models = ['a', 'b', 'c', 'd'];
    const rows = models.map((model, index) => ({ bucket: day('11'), model, cost: 10 - index }));

    const result = buildCostSeries(rows, [day('11')]);

    expect(result.series).toEqual(['a', 'b', OTHER_SERIES]);
    expect(result.buckets[0]?.values).toEqual([10, 9, 15]);
  });
});

describe('niceCeiling', () => {
  it('rounds up to a readable axis maximum', () => {
    expect(niceCeiling(73)).toBe(100);
    expect(niceCeiling(41)).toBe(50);
    expect(niceCeiling(4.2)).toBe(5);
    expect(niceCeiling(0)).toBe(1);
  });
});

describe('linePoints', () => {
  it('centres points in their bucket and skips gaps', () => {
    expect(linePoints([0, null, 5], 5, 300, 100)).toBe('50.0,100.0 250.0,0.0');
  });
});

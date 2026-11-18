import { describe, expect, it } from 'vitest';
import { computeCost, findPrice, type ModelPrice } from './cost.ts';

const prices: ModelPrice[] = [
  { model: 'gpt-4.1', inputPer1m: 2, outputPer1m: 8, validFrom: new Date('2025-01-01') },
  { model: 'gpt-4.1-mini', inputPer1m: 0.4, outputPer1m: 1.6, validFrom: new Date('2025-01-01') },
  { model: 'gpt-4.1', inputPer1m: 1.5, outputPer1m: 6, validFrom: new Date('2026-06-01') },
];

describe('findPrice', () => {
  it('prefers the longest matching model name', () => {
    const price = findPrice(prices, 'gpt-4.1-mini-2025-04-14', new Date('2026-11-01'));

    expect(price?.model).toBe('gpt-4.1-mini');
  });

  it('uses the latest price valid at the call time', () => {
    expect(findPrice(prices, 'gpt-4.1', new Date('2026-01-01'))?.inputPer1m).toBe(2);
    expect(findPrice(prices, 'gpt-4.1', new Date('2026-07-01'))?.inputPer1m).toBe(1.5);
  });

  it('returns undefined for unknown models', () => {
    expect(findPrice(prices, 'llama-3', new Date())).toBeUndefined();
  });
});

describe('computeCost', () => {
  it('prices input and output tokens per million', () => {
    const price = { model: 'm', inputPer1m: 3, outputPer1m: 15, validFrom: new Date(0) };

    expect(computeCost({ input: 1_000_000, output: 100_000 }, price)).toBeCloseTo(4.5);
  });
});

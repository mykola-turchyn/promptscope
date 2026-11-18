import { providerForModel } from '@promptscope/shared';
import { describe, expect, it } from 'vitest';
import { parseJudgeScore } from './judge.ts';
import { percentile, summarize } from './summary.ts';

describe('parseJudgeScore', () => {
  it('reads and clamps the score from the judge JSON', () => {
    expect(parseJudgeScore('{"score": 4, "reasoning": "ok"}')).toBe(4);
    expect(parseJudgeScore('Sure! {"score": 9}')).toBe(5);
  });

  it('fails loudly when there is no score', () => {
    expect(() => parseJudgeScore('I think it is good')).toThrow('no score');
  });
});

describe('summarize', () => {
  it('averages each scorer over the items that have it', () => {
    const summary = summarize(
      ['Helpfulness', 'Valid JSON'],
      [
        { scores: { Helpfulness: 4, 'Valid JSON': 1 }, latencyMs: 1000 },
        { scores: { Helpfulness: 5 }, latencyMs: 3000 },
      ],
      60_000,
    );

    expect(summary.scores).toEqual({ Helpfulness: 4.5, 'Valid JSON': 1 });
    expect(summary).toMatchObject({ itemCount: 2, latencyP95Ms: 3000, durationMs: 60_000 });
  });
});

describe('percentile', () => {
  it('uses the nearest-rank method', () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.95)).toBe(10);
    expect(percentile([], 0.95)).toBe(0);
  });
});

describe('providerForModel', () => {
  it('infers the provider from the model name unless set', () => {
    expect(providerForModel('claude-sonnet-4-5')).toBe('anthropic');
    expect(providerForModel('gpt-4.1')).toBe('openai');
    expect(providerForModel('my-model', 'anthropic')).toBe('anthropic');
  });
});

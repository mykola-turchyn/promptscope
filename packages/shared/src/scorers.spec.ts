import { describe, expect, it } from 'vitest';
import { clampJudgeScore, createCodeScorer } from './scorers.ts';

const context = (output: unknown, expected: unknown = null) => ({ input: {}, output, expected });

describe('createCodeScorer', () => {
  it('scores exact matches ignoring surrounding whitespace', () => {
    const scorer = createCodeScorer({ name: 'exact', kind: 'exact_match' });

    expect(scorer.score(context(' refund ', 'refund'))).toBe(1);
    expect(scorer.score(context('refund', 'deny'))).toBe(0);
  });

  it('checks substrings and patterns', () => {
    const contains = createCodeScorer({ name: 'c', kind: 'contains', value: 'issue_refund' });
    const regex = createCodeScorer({ name: 'r', kind: 'regex', pattern: '^\\$\\d+' });

    expect(contains.score(context('calls issue_refund(ch_A2)'))).toBe(1);
    expect(regex.score(context('$49 refunded'))).toBe(1);
    expect(regex.score(context('refunded $49'))).toBe(0);
  });

  it('validates JSON output against a JSON schema', () => {
    const scorer = createCodeScorer({
      name: 'json',
      kind: 'json_schema',
      schema: {
        type: 'object',
        properties: { amount: { type: 'number' } },
        required: ['amount'],
      },
    });

    expect(scorer.score(context('{"amount": 49}'))).toBe(1);
    expect(scorer.score(context('{"amount": "49"}'))).toBe(0);
    expect(scorer.score(context('not json'))).toBe(0);
  });

  it('checks length bounds', () => {
    const scorer = createCodeScorer({ name: 'len', kind: 'length', min: 2, max: 4 });

    expect(scorer.score(context('abc'))).toBe(1);
    expect(scorer.score(context('abcde'))).toBe(0);
  });
});

describe('clampJudgeScore', () => {
  it('rounds into the 1–5 range', () => {
    expect(clampJudgeScore(7)).toBe(5);
    expect(clampJudgeScore(0)).toBe(1);
    expect(clampJudgeScore(3.6)).toBe(4);
  });
});

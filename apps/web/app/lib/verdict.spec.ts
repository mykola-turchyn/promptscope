import { describe, expect, it } from 'vitest';
import { buildVerdict, type ScorerSummary, scorerRows } from './verdict';

const scorers: ScorerSummary[] = [
  { name: 'Correct tool call', kind: 'llm_judge', a: 4.0, b: 4.5 },
  { name: 'Refund within limit', kind: 'regex', a: 0.942, b: 1 },
  { name: 'Valid JSON arguments', kind: 'json_schema', a: 0.967, b: 0.992 },
  { name: 'Helpfulness', kind: 'llm_judge', a: 4.2, b: 4.1 },
];

describe('buildVerdict', () => {
  it('summarises wins and lists what got worse, cost and latency', () => {
    const verdict = buildVerdict({
      candidateLabel: 'v8',
      scorers,
      cost: { a: 2.52, b: 2.67 },
      p95: { a: 3_400, b: 3_600 },
    });

    expect(verdict).toEqual({
      candidateWins: true,
      headline: 'v8 wins on 3 of 4 scorers',
      details: 'Helpfulness −0.1, cost +6%, p95 +0.2 s',
    });
  });

  it('does not declare a winner when the candidate is worse', () => {
    const verdict = buildVerdict({
      candidateLabel: 'v9',
      scorers: [{ name: 'Helpfulness', kind: 'llm_judge', a: 4.2, b: 3.1 }],
      cost: { a: 1, b: 1 },
      p95: { a: 1_000, b: 1_000 },
    });

    expect(verdict.candidateWins).toBe(false);
  });
});

describe('scorerRows', () => {
  it('formats pass rates as percentages and judge scores out of five', () => {
    const rows = scorerRows(scorers, () => 'label');

    expect(rows[1]).toMatchObject({ a: '94.2%', b: '100.0%', delta: '+5.8 pp', bWidth: 100 });
    expect(rows[3]).toMatchObject({ a: '4.2', b: '4.1', delta: '−0.1', improved: false });
  });
});

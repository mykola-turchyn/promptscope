import { isPassRateScorer, type ScorerKind } from '@promptscope/shared/scorers';

const PERCENT = 100;
const MS_PER_SECOND = 1_000;
const JUDGE_MAX = 5;
const EPSILON = 1e-9;

export interface ScorerSummary {
  name: string;
  kind: ScorerKind;
  a: number;
  b: number;
}

export interface ScorerRow {
  name: string;
  kindLabel: string;
  a: string;
  b: string;
  aWidth: number;
  bWidth: number;
  delta: string;
  improved: boolean;
}

function minus(value: number): string {
  return value >= 0 ? `+${value}` : `−${Math.abs(value)}`;
}

export function formatScore(kind: ScorerKind, value: number): string {
  return isPassRateScorer(kind) ? `${(value * PERCENT).toFixed(1)}%` : value.toFixed(1);
}

function shown(kind: ScorerKind, value: number): number {
  return isPassRateScorer(kind) ? Number((value * PERCENT).toFixed(1)) : Number(value.toFixed(1));
}

// Deltas use the rounded values on screen, so 4.1 → 4.2 always reads +0.1.
export function formatScoreDelta(kind: ScorerKind, a: number, b: number): string {
  const delta = Number((shown(kind, b) - shown(kind, a)).toFixed(1));

  return isPassRateScorer(kind) ? `${minus(delta)} pp` : minus(delta);
}

export function scorerRows(
  scorers: ScorerSummary[],
  kindLabel: (kind: ScorerKind) => string,
): ScorerRow[] {
  return scorers.map(({ name, kind, a, b }) => {
    const max = isPassRateScorer(kind) ? 1 : JUDGE_MAX;

    return {
      name,
      kindLabel: kindLabel(kind),
      a: formatScore(kind, a),
      b: formatScore(kind, b),
      aWidth: (a / max) * PERCENT,
      bWidth: (b / max) * PERCENT,
      delta: formatScoreDelta(kind, a, b),
      improved: shown(kind, b) >= shown(kind, a),
    };
  });
}

export interface Verdict {
  candidateWins: boolean;
  headline: string;
  details: string;
}

export function buildVerdict(input: {
  candidateLabel: string;
  scorers: ScorerSummary[];
  cost: { a: number; b: number };
  p95: { a: number; b: number };
}): Verdict {
  const { scorers, cost, p95 } = input;
  const wins = scorers.filter(({ a, b }) => b - a > EPSILON).length;
  const losses = scorers.filter(({ a, b }) => a - b > EPSILON);
  const candidateWins = wins > losses.length;
  const costChange = cost.a === 0 ? 0 : ((cost.b - cost.a) / cost.a) * PERCENT;
  const p95Change = (p95.b - p95.a) / MS_PER_SECOND;
  const details = [
    ...losses.map(({ name, kind, a, b }) => `${name} ${formatScoreDelta(kind, a, b)}`),
    `cost ${minus(Math.round(costChange))}%`,
    `p95 ${minus(Number(p95Change.toFixed(1)))} s`,
  ].join(', ');
  const headline = candidateWins
    ? `${input.candidateLabel} wins on ${wins} of ${scorers.length} scorers`
    : `${input.candidateLabel} does not beat the baseline (${wins} of ${scorers.length} scorers better)`;

  return { candidateWins, headline, details };
}

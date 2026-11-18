import { clampJudgeScore, outputAsText, type Scorer, type ScorerConfig } from '@promptscope/shared';
import type { PriceBook } from '../prices.ts';
import type { LlmClient } from './llm.ts';

type JudgeConfig = Extract<ScorerConfig, { kind: 'llm_judge' }>;

const JUDGE_TEMPERATURE = 0;
const JUDGE_MAX_TOKENS = 300;
const SCORE_PATTERN = /"score"\s*:\s*(\d+(?:\.\d+)?)/;

// Calibration examples anchor the scale so scores stay comparable between runs (ADR 0003).
const JUDGE_SYSTEM = `You grade one AI answer against a rubric. Judge only the answer shown.
Ignore its length and style unless the rubric asks about them.
Reply with JSON only: {"score": <integer 1-5>, "reasoning": "<one sentence>"}.

Calibration:
- 5: fully meets the rubric, nothing to fix.
- 3: partly meets it, with a clear mistake or omission.
- 1: fails the rubric or is unrelated to the request.`;

export function judgePrompt(
  config: JudgeConfig,
  input: unknown,
  output: unknown,
  expected: unknown,
): string {
  return [
    `Rubric: ${config.rubric}`,
    `Request: ${outputAsText(input)}`,
    expected === null || expected === undefined
      ? ''
      : `Reference answer: ${outputAsText(expected)}`,
    `Answer to grade: ${outputAsText(output)}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function parseJudgeScore(text: string): number {
  const match = SCORE_PATTERN.exec(text);
  if (!match?.[1]) throw new Error(`Judge returned no score: ${text.slice(0, 200)}`);

  return clampJudgeScore(Number(match[1]));
}

export function createJudgeScorer(
  config: JudgeConfig,
  llm: LlmClient,
  prices: PriceBook,
  onCost: (cost: number) => void,
): Scorer {
  return {
    name: config.name,
    kind: config.kind,
    async score({ input, output, expected }) {
      const response = await llm.complete({
        model: config.model,
        system: JUDGE_SYSTEM,
        prompt: judgePrompt(config, input, output, expected),
        temperature: JUDGE_TEMPERATURE,
        maxTokens: JUDGE_MAX_TOKENS,
      });
      onCost(prices.cost(config.model, response.usage, new Date()) ?? 0);

      return parseJudgeScore(response.text);
    },
  };
}

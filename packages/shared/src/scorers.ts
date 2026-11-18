import { z } from 'zod';

const JUDGE_MIN_SCORE = 1;
const JUDGE_MAX_SCORE = 5;
const PASS = 1;
const FAIL = 0;

const scorerBase = { name: z.string().min(1).max(80) };

export const scorerConfigSchema = z.discriminatedUnion('kind', [
  z.object({ ...scorerBase, kind: z.literal('exact_match') }),
  z.object({ ...scorerBase, kind: z.literal('contains'), value: z.string().min(1) }),
  z.object({ ...scorerBase, kind: z.literal('regex'), pattern: z.string().min(1) }),
  z.object({
    ...scorerBase,
    kind: z.literal('json_schema'),
    schema: z.record(z.string(), z.json()),
  }),
  z.object({
    ...scorerBase,
    kind: z.literal('length'),
    min: z.number().int().nonnegative().optional(),
    max: z.number().int().positive().optional(),
  }),
  z.object({
    ...scorerBase,
    kind: z.literal('llm_judge'),
    rubric: z.string().min(1),
    model: z.string().min(1),
  }),
]);
export type ScorerConfig = z.infer<typeof scorerConfigSchema>;
export type ScorerKind = ScorerConfig['kind'];

export interface ScorerContext<Input = unknown, Output = unknown> {
  input: Input;
  output: Output;
  expected: unknown;
}

export interface Scorer<Input = unknown, Output = unknown> {
  name: string;
  kind: ScorerKind;
  score(context: ScorerContext<Input, Output>): number | Promise<number>;
}

export const SCORER_SCALE: Record<ScorerKind, { max: number; label: string }> = {
  exact_match: { max: PASS, label: 'Code check · pass rate' },
  contains: { max: PASS, label: 'Code check · pass rate' },
  regex: { max: PASS, label: 'Code check · pass rate' },
  json_schema: { max: PASS, label: 'Zod schema · pass rate' },
  length: { max: PASS, label: 'Code check · pass rate' },
  llm_judge: { max: JUDGE_MAX_SCORE, label: `LLM judge · ${JUDGE_MIN_SCORE}–${JUDGE_MAX_SCORE}` },
};

export function isPassRateScorer(kind: ScorerKind): boolean {
  return kind !== 'llm_judge';
}

export function clampJudgeScore(value: number): number {
  return Math.min(JUDGE_MAX_SCORE, Math.max(JUDGE_MIN_SCORE, Math.round(value)));
}

export function outputAsText(output: unknown): string {
  if (typeof output === 'string') return output;

  return JSON.stringify(output ?? '');
}

function passFail(passed: boolean): number {
  return passed ? PASS : FAIL;
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

type CodeScorerConfig = Exclude<ScorerConfig, { kind: 'llm_judge' }>;

export function createCodeScorer(config: CodeScorerConfig): Scorer {
  const base = { name: config.name, kind: config.kind };

  switch (config.kind) {
    case 'exact_match':
      return {
        ...base,
        score: ({ output, expected }) =>
          passFail(outputAsText(output).trim() === outputAsText(expected).trim()),
      };
    case 'contains':
      return {
        ...base,
        score: ({ output }) => passFail(outputAsText(output).includes(config.value)),
      };
    case 'regex': {
      const pattern = new RegExp(config.pattern);

      return { ...base, score: ({ output }) => passFail(pattern.test(outputAsText(output))) };
    }
    case 'json_schema': {
      const schema = z.fromJSONSchema(config.schema);

      return {
        ...base,
        score: ({ output }) => {
          const parsed =
            typeof output === 'string' ? parseJson(output) : { ok: true, value: output };

          return passFail(parsed.ok && schema.safeParse(parsed.value).success);
        },
      };
    }
    case 'length':
      return {
        ...base,
        score: ({ output }) => {
          const { length } = outputAsText(output);
          const aboveMin = config.min === undefined || length >= config.min;
          const belowMax = config.max === undefined || length <= config.max;

          return passFail(aboveMin && belowMax);
        },
      };
  }
}

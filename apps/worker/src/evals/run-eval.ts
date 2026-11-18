import { type Db, schema } from '@promptscope/db';
import {
  createCodeScorer,
  renderTemplate,
  type Scorer,
  type ScorerConfig,
} from '@promptscope/shared';
import { eq } from 'drizzle-orm';
import pLimit from 'p-limit';
import type { PriceBook } from '../prices.ts';
import { createJudgeScorer } from './judge.ts';
import type { LlmClient } from './llm.ts';
import { summarize } from './summary.ts';

const ITEM_CONCURRENCY = 4;
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_MODEL = 'gpt-4.1-mini';
const MAX_ERROR_LENGTH = 2_000;

type ResultRow = typeof schema.evalResults.$inferInsert;

export interface EvalDependencies {
  db: Db;
  llm: LlmClient;
  prices: PriceBook;
  onProgress(progress: { runId: string; projectId: string; done: number; total: number }): void;
}

function templateValues(input: unknown): Record<string, unknown> {
  return input !== null && typeof input === 'object' && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : { input };
}

function buildScorers(
  configs: ScorerConfig[],
  dependencies: EvalDependencies,
  onCost: (cost: number) => void,
): Scorer[] {
  return configs.map((config) =>
    config.kind === 'llm_judge'
      ? createJudgeScorer(config, dependencies.llm, dependencies.prices, onCost)
      : createCodeScorer(config),
  );
}

async function saveResult(db: Db, result: ResultRow) {
  await db
    .insert(schema.evalResults)
    .values(result)
    .onConflictDoUpdate({
      target: [schema.evalResults.runId, schema.evalResults.itemId],
      set: {
        output: result.output,
        scores: result.scores,
        cost: result.cost,
        latencyMs: result.latencyMs,
        error: result.error,
      },
    });
}

export async function runEval(dependencies: EvalDependencies, runId: string) {
  const { db, llm, prices } = dependencies;
  const [row] = await db
    .select({ run: schema.evalRuns, version: schema.promptVersions })
    .from(schema.evalRuns)
    .innerJoin(schema.promptVersions, eq(schema.promptVersions.id, schema.evalRuns.promptVersionId))
    .where(eq(schema.evalRuns.id, runId));
  if (!row || row.run.status === 'completed') return;
  const { run, version } = row;
  const items = await db
    .select()
    .from(schema.datasetItems)
    .where(eq(schema.datasetItems.datasetId, run.datasetId));
  const startedAt = run.startedAt ?? new Date();
  await db
    .update(schema.evalRuns)
    .set({ status: 'running', startedAt, error: null })
    .where(eq(schema.evalRuns.id, runId));

  let totalCost = 0;
  let stopped = false;
  let done = 0;
  const addCost = (cost: number) => {
    totalCost += cost;
    if (run.costLimit !== null && totalCost >= run.costLimit) stopped = true;
  };
  const scorers = buildScorers(run.scorers, dependencies, addCost);
  const model = version.modelConfig.model ?? DEFAULT_MODEL;
  const limit = pLimit(ITEM_CONCURRENCY);

  await Promise.all(
    items.map((item) =>
      limit(async () => {
        if (stopped) return;
        const result: ResultRow = { runId, itemId: item.id, scores: {} };
        try {
          const response = await llm.complete({
            provider: version.modelConfig.provider,
            model,
            prompt: renderTemplate(version.template, templateValues(item.input)),
            temperature: version.modelConfig.temperature ?? DEFAULT_TEMPERATURE,
            maxTokens: version.modelConfig.maxTokens ?? DEFAULT_MAX_TOKENS,
          });
          const cost = prices.cost(model, response.usage, new Date()) ?? 0;
          addCost(cost);
          const context = { input: item.input, output: response.text, expected: item.expected };
          const scores: Record<string, number> = {};
          for (const scorer of scorers) {
            scores[scorer.name] = await scorer.score(context);
          }
          Object.assign(result, {
            output: { text: response.text },
            scores,
            cost,
            latencyMs: response.latencyMs,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.error = message.slice(0, MAX_ERROR_LENGTH);
        }
        await saveResult(db, result);
        done += 1;
        dependencies.onProgress({ runId, projectId: run.projectId, done, total: items.length });
      }),
    ),
  );

  const results = await db
    .select({ scores: schema.evalResults.scores, latencyMs: schema.evalResults.latencyMs })
    .from(schema.evalResults)
    .where(eq(schema.evalResults.runId, runId));
  const finishedAt = new Date();
  await db
    .update(schema.evalRuns)
    .set({
      status: stopped ? 'stopped' : 'completed',
      totalCost,
      finishedAt,
      error: stopped ? `Stopped after reaching the cost limit of $${run.costLimit}` : null,
      summary: summarize(
        run.scorers.map(({ name }) => name),
        results,
        finishedAt.getTime() - startedAt.getTime(),
      ),
    })
    .where(eq(schema.evalRuns.id, runId));
}

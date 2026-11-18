import type { DbOrTransaction } from '../client.ts';
import { modelPrices } from '../schema/index.ts';

const PRICES_VALID_FROM = new Date('2025-01-01T00:00:00Z');

export const DEFAULT_MODEL_PRICES = [
  { provider: 'anthropic', model: 'claude-fable-5-2', inputPer1m: 8, outputPer1m: 40 },
  { provider: 'anthropic', model: 'claude-opus-5-5', inputPer1m: 4, outputPer1m: 20 },
  { provider: 'anthropic', model: 'claude-sonnet-5-5', inputPer1m: 2, outputPer1m: 10 },
  { provider: 'anthropic', model: 'claude-haiku-5-5', inputPer1m: 0.1, outputPer1m: 0.5 },
  { provider: 'anthropic', model: 'claude-sonnet-4-5', inputPer1m: 3, outputPer1m: 15 },
  { provider: 'anthropic', model: 'claude-haiku-4-5', inputPer1m: 1, outputPer1m: 5 },
  { provider: 'anthropic', model: 'claude-opus-4-1', inputPer1m: 15, outputPer1m: 75 },
  { provider: 'openai', model: 'gpt-4.1', inputPer1m: 2, outputPer1m: 8 },
  { provider: 'openai', model: 'gpt-4.1-mini', inputPer1m: 0.4, outputPer1m: 1.6 },
  { provider: 'openai', model: 'gpt-4.1-nano', inputPer1m: 0.1, outputPer1m: 0.4 },
  { provider: 'openai', model: 'gpt-5', inputPer1m: 1.25, outputPer1m: 10 },
  { provider: 'openai', model: 'gpt-5-mini', inputPer1m: 0.25, outputPer1m: 2 },
  { provider: 'openai', model: 'text-embedding-3-small', inputPer1m: 0.02, outputPer1m: 0 },
].map((price) => ({ ...price, validFrom: PRICES_VALID_FROM }));

export async function seedModelPrices(db: DbOrTransaction) {
  await db.insert(modelPrices).values(DEFAULT_MODEL_PRICES).onConflictDoNothing();
}

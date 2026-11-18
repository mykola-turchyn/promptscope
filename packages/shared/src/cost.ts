import type { Usage } from './events.ts';

const TOKENS_PER_PRICE_UNIT = 1_000_000;

export interface ModelPrice {
  model: string;
  inputPer1m: number;
  outputPer1m: number;
  validFrom: Date;
}

export function findPrice(
  prices: readonly ModelPrice[],
  model: string,
  at: Date,
): ModelPrice | undefined {
  const candidates = prices.filter(
    (price) => model.startsWith(price.model) && price.validFrom.getTime() <= at.getTime(),
  );

  return candidates.sort(
    (left, right) =>
      right.model.length - left.model.length ||
      right.validFrom.getTime() - left.validFrom.getTime(),
  )[0];
}

export function computeCost(usage: Usage, price: ModelPrice): number {
  const inputCost = (usage.input * price.inputPer1m) / TOKENS_PER_PRICE_UNIT;
  const outputCost = (usage.output * price.outputPer1m) / TOKENS_PER_PRICE_UNIT;

  return inputCost + outputCost;
}

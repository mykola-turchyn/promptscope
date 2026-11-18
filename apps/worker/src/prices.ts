import { type Db, schema } from '@promptscope/db';
import { computeCost, findPrice, type ModelPrice, type Usage } from '@promptscope/shared';

const REFRESH_INTERVAL_MS = 5 * 60_000;

export interface PriceBook {
  cost(model: string | null | undefined, usage: Usage | null | undefined, at: Date): number | null;
}

export function priceBookFrom(prices: readonly ModelPrice[]): PriceBook {
  return {
    cost(model, usage, at) {
      if (!model || !usage) return null;
      const price = findPrice(prices, model, at);

      return price ? computeCost(usage, price) : null;
    },
  };
}

export function createPriceCache(db: Db) {
  let prices: ModelPrice[] = [];
  let loadedAt = 0;

  return {
    async get(): Promise<PriceBook> {
      if (Date.now() - loadedAt > REFRESH_INTERVAL_MS) {
        prices = await db
          .select({
            model: schema.modelPrices.model,
            inputPer1m: schema.modelPrices.inputPer1m,
            outputPer1m: schema.modelPrices.outputPer1m,
            validFrom: schema.modelPrices.validFrom,
          })
          .from(schema.modelPrices);
        loadedAt = Date.now();
      }

      return priceBookFrom(prices);
    },
  };
}

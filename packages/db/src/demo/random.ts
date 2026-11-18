const MULBERRY_INCREMENT = 0x6d2b79f5;
const UINT32_RANGE = 4_294_967_296;

export interface Random {
  next(): number;
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  chance(probability: number): boolean;
  normal(mean: number, deviation: number): number;
  hex(length: number): string;
}

export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  const next = () => {
    state = (state + MULBERRY_INCREMENT) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));

  return {
    next,
    int,
    pick: <T>(items: readonly T[]): T => {
      const item = items[Math.floor(next() * items.length)];
      if (item === undefined) throw new Error('Cannot pick from an empty list');

      return item;
    },
    chance: (probability) => next() < probability,
    normal: (mean, deviation) => {
      const u = Math.max(next(), Number.EPSILON);
      const v = next();

      return mean + deviation * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    hex: (length) => {
      let result = '';
      for (let index = 0; index < length; index += 1) result += int(0, 15).toString(16);

      return result;
    },
  };
}

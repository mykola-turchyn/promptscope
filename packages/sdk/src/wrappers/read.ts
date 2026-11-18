type Key = string | number;

export function read(value: unknown, ...path: Key[]): unknown {
  let current = value;
  for (const key of path) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<Key, unknown>)[key];
  }

  return current;
}

export function readNumber(value: unknown, ...path: Key[]): number | undefined {
  const result = read(value, ...path);

  return typeof result === 'number' ? result : undefined;
}

export function readString(value: unknown, ...path: Key[]): string | undefined {
  const result = read(value, ...path);

  return typeof result === 'string' ? result : undefined;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

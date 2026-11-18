export interface TreeSpan {
  id: string;
  parentId: string | null;
  startedAt: Date;
  endedAt: Date;
}

export type FlatSpan<T extends TreeSpan> = T & { depth: number };

// Depth-first order with children sorted by start time; spans whose parent is missing become roots.
export function flattenSpanTree<T extends TreeSpan>(spans: T[]): FlatSpan<T>[] {
  const ids = new Set(spans.map(({ id }) => id));
  const children = new Map<string | null, T[]>();
  for (const span of spans) {
    const parent = span.parentId && ids.has(span.parentId) ? span.parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), span]);
  }
  for (const list of children.values()) {
    list.sort((left, right) => left.startedAt.getTime() - right.startedAt.getTime());
  }
  const result: FlatSpan<T>[] = [];
  const stack: Array<{ span: T; depth: number }> = (children.get(null) ?? [])
    .map((span) => ({ span, depth: 0 }))
    .reverse();
  while (stack.length > 0) {
    const next = stack.pop();
    if (!next) break;
    result.push({ ...next.span, depth: next.depth });
    const kids = children.get(next.span.id) ?? [];
    for (let index = kids.length - 1; index >= 0; index -= 1) {
      const kid = kids[index];
      if (kid) stack.push({ span: kid, depth: next.depth + 1 });
    }
  }

  return result;
}

const TICK_STEPS = [1, 2, 5, 10];
const TARGET_TICKS = 4;

export function timelineTicks(totalMs: number): number[] {
  if (totalMs <= 0) return [0];
  const rough = totalMs / TARGET_TICKS;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = (TICK_STEPS.find((candidate) => candidate * magnitude >= rough) ?? 10) * magnitude;
  const ticks: number[] = [];
  for (let tick = 0; tick < totalMs; tick += step) ticks.push(tick);

  return ticks;
}

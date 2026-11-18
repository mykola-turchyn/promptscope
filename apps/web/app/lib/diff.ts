export type DiffKind = 'same' | 'add' | 'del';

export interface DiffLine {
  id: number;
  kind: DiffKind;
  text: string;
  /** Line number in the new text; deleted lines have none. */
  number: number | null;
}

export function diffLines(before: string, after: string): DiffLine[] {
  const left = before.split('\n');
  const right = after.split('\n');
  const rows = left.length + 1;
  const columns = right.length + 1;
  const lcs = Array.from({ length: rows }, () => new Array<number>(columns).fill(0));
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      const row = lcs[i];
      const below = lcs[i + 1];
      if (!row || !below) continue;
      row[j] =
        left[i] === right[j] ? (below[j + 1] ?? 0) + 1 : Math.max(below[j] ?? 0, row[j + 1] ?? 0);
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let number = 0;
  while (i < left.length || j < right.length) {
    const leftLine = left[i];
    const rightLine = right[j];
    if (i < left.length && j < right.length && leftLine === rightLine) {
      number += 1;
      result.push({ id: result.length, kind: 'same', text: leftLine ?? '', number });
      i += 1;
      j += 1;
    } else if (
      j < right.length &&
      (i >= left.length || (lcs[i]?.[j + 1] ?? 0) >= (lcs[i + 1]?.[j] ?? 0))
    ) {
      number += 1;
      result.push({ id: result.length, kind: 'add', text: rightLine ?? '', number });
      j += 1;
    } else {
      result.push({ id: result.length, kind: 'del', text: leftLine ?? '', number: null });
      i += 1;
    }
  }

  return orderDeletionsFirst(result);
}

// Within each changed block show removed lines before added ones, like a unified diff.
function orderDeletionsFirst(lines: DiffLine[]): DiffLine[] {
  const ordered: DiffLine[] = [];
  let block: DiffLine[] = [];
  const flush = () => {
    ordered.push(
      ...block.filter(({ kind }) => kind === 'del'),
      ...block.filter(({ kind }) => kind === 'add'),
    );
    block = [];
  };
  for (const line of lines) {
    if (line.kind === 'same') {
      flush();
      ordered.push(line);
    } else {
      block.push(line);
    }
  }
  flush();

  return ordered;
}

export function diffStats(lines: DiffLine[]): { added: number; removed: number } {
  return {
    added: lines.filter(({ kind }) => kind === 'add').length,
    removed: lines.filter(({ kind }) => kind === 'del').length,
  };
}

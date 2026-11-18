import { describe, expect, it } from 'vitest';
import { diffLines, diffStats } from './diff';

describe('diffLines', () => {
  it('marks replaced lines as a deletion followed by additions', () => {
    const before = [
      'Refund only duplicate charges.',
      'Always confirm the amount.',
      'Hand off on failure.',
    ].join('\n');
    const after = [
      'Refund only duplicate charges.',
      'Confirm the charge ID and amount',
      'with get_order.',
      'Hand off on failure.',
    ].join('\n');

    const lines = diffLines(before, after);

    expect(lines.map(({ kind, number }) => `${kind}:${number ?? '-'}`)).toEqual([
      'same:1',
      'del:-',
      'add:2',
      'add:3',
      'same:4',
    ]);
    expect(diffStats(lines)).toEqual({ added: 2, removed: 1 });
  });

  it('returns only unchanged lines for identical text', () => {
    expect(diffStats(diffLines('a\nb', 'a\nb'))).toEqual({ added: 0, removed: 0 });
  });
});

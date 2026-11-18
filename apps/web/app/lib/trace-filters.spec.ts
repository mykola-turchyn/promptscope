import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor } from '../.server/cursor';
import { clearFiltersHref, filterChips, parseTraceFilters } from './trace-filters';

describe('parseTraceFilters', () => {
  it('reads known filters and ignores invalid values', () => {
    const filters = parseTraceFilters(
      new URLSearchParams('q=refund&status=slow&prompt=not-a-uuid&sort=cost&model='),
    );

    expect(filters).toEqual({ q: 'refund', status: 'slow', sort: 'cost' });
  });

  it('falls back to sorting by start time', () => {
    expect(parseTraceFilters(new URLSearchParams('sort=random')).sort).toBe('started');
  });
});

describe('filterChips', () => {
  it('builds a removable chip per active filter that also resets paging', () => {
    const params = new URLSearchParams('env=production&status=error&cursor=abc&page=3&sort=cost');

    const chips = filterChips(params);

    expect(chips.map(({ label }) => label)).toEqual(['status = error', 'env = production']);
    expect(chips[1]?.removeHref).toBe('?status=error&sort=cost');
    expect(clearFiltersHref(params)).toBe('?sort=cost');
  });
});

describe('cursor', () => {
  it('round-trips and rejects garbage', () => {
    const cursor = { value: '2026-11-17T10:00:00.000Z', id: 'tr_1' };

    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
    expect(decodeCursor('not-base64-json')).toBeNull();
  });
});

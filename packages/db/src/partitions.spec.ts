import { describe, expect, it } from 'vitest';
import { monthStart, monthsBetween } from './partitions.ts';

describe('monthsBetween', () => {
  it('lists every month start in the range, inclusive', () => {
    const months = monthsBetween(
      new Date('2026-11-17T00:00:00Z'),
      new Date('2027-01-02T00:00:00Z'),
    );

    expect(months).toEqual(['2026-11-01', '2026-12-01', '2027-01-01']);
  });

  it('formats the month start in UTC', () => {
    expect(monthStart(new Date('2026-03-31T23:59:59Z'))).toBe('2026-03-01');
  });
});

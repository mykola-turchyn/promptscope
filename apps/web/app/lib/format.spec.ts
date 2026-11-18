import { describe, expect, it } from 'vitest';
import {
  formatCost,
  formatDateTimeSeconds,
  formatDay,
  formatDayRange,
  formatDuration,
  formatRelative,
  formatStarted,
  formatTokens,
} from './format';

const UTC = 'UTC';

describe('formatCost', () => {
  it('matches the precision used in the design', () => {
    expect(formatCost(412.381)).toBe('$412.38');
    expect(formatCost(1234.5)).toBe('$1,234.50');
    expect(formatCost(0.6124)).toBe('$0.612');
    expect(formatCost(0.018)).toBe('$0.018');
    expect(formatCost(0.00039)).toBe('$0.0004');
    expect(formatCost(0.00001)).toBe('$0.00001');
    expect(formatCost(null)).toBe('—');
  });
});

describe('formatDuration', () => {
  it('uses seconds with one decimal, minutes above a minute', () => {
    expect(formatDuration(18_400)).toBe('18.4 s');
    expect(formatDuration(200)).toBe('0.2 s');
    expect(formatDuration(252_000)).toBe('4 min 12 s');
  });
});

describe('formatTokens', () => {
  it('shows input and output with separators', () => {
    expect(formatTokens(28_940, 2_115)).toBe('28,940 / 2,115');
  });
});

describe('dates', () => {
  const date = new Date('2026-11-07T14:02:51Z');

  it('formats days and full timestamps', () => {
    expect(formatDay(date, UTC)).toBe('Nov 7');
    expect(formatDateTimeSeconds(date, UTC)).toBe('Nov 7, 2026, 14:02:51');
    expect(formatDayRange(new Date('2026-11-11T00:00Z'), new Date('2026-11-17T00:00Z'), UTC)).toBe(
      'Nov 11 – Nov 17, 2026',
    );
  });

  it('shows only the time for traces started today', () => {
    expect(formatStarted(date, new Date('2026-11-07T20:00:00Z'), UTC)).toBe('14:02:51');
    expect(formatStarted(date, new Date('2026-11-08T20:00:00Z'), UTC)).toBe('Nov 7, 14:02');
  });

  it('respects the viewer time zone', () => {
    expect(formatStarted(date, date, 'Europe/Kyiv')).toBe('16:02:51');
  });

  it('describes recent times relatively', () => {
    const now = new Date('2026-11-17T12:00:00Z');
    expect(formatRelative(null, now)).toBe('Never');
    expect(formatRelative(new Date('2026-11-17T11:59:48Z'), now)).toBe('12 s ago');
    expect(formatRelative(new Date('2026-11-14T12:00:00Z'), now)).toBe('3 days ago');
  });
});

import { describe, expect, it } from 'vitest';
import { escapeCsvCell, parseCsv, toCsv } from './csv';

describe('escapeCsvCell', () => {
  it('quotes separators and neutralises formulas', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(escapeCsvCell(-1.5)).toBe('-1.5');
  });
});

describe('parseCsv', () => {
  it('round-trips quoted cells, newlines inside quotes and CRLF', () => {
    const csv = toCsv(['input', 'expected'], [['Hello, "world"', 'line 1\nline 2']]);

    expect(parseCsv(`${csv}\r\n`)).toEqual([
      ['input', 'expected'],
      ['Hello, "world"', 'line 1\nline 2'],
    ]);
  });
});

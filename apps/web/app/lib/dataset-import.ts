import { parseCsv } from './csv';

export const MAX_IMPORT_ROWS = 10_000;

export interface ImportedItem {
  input: unknown;
  expected: unknown;
}

export type ImportResult = { ok: true; items: ImportedItem[] } | { ok: false; error: string };

const INPUT_COLUMN = 'input';
const EXPECTED_COLUMN = 'expected';

// Text that is valid JSON becomes structured data; anything else is treated as a chat message.
export function parseCellValue(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  if (/^[[{"]/.test(trimmed)) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Not JSON after all, keep it as text.
    }
  }

  return trimmed;
}

export function asItemInput(value: unknown): unknown {
  return typeof value === 'string' ? { message: value } : value;
}

function fromCsv(text: string): ImportResult {
  const [header, ...rows] = parseCsv(text);
  const columns = header?.map((cell) => cell.trim().toLowerCase()) ?? [];
  const inputIndex = columns.indexOf(INPUT_COLUMN);
  const expectedIndex = columns.indexOf(EXPECTED_COLUMN);
  if (inputIndex === -1) return { ok: false, error: 'The CSV needs an "input" column.' };

  return {
    ok: true,
    items: rows.map((row) => ({
      input: asItemInput(parseCellValue(row[inputIndex] ?? '')),
      expected: expectedIndex === -1 ? null : parseCellValue(row[expectedIndex] ?? ''),
    })),
  };
}

function fromJsonl(text: string): ImportResult {
  const items: ImportedItem[] = [];
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  for (const [index, line] of lines.entries()) {
    try {
      const value: unknown = JSON.parse(line);
      if (typeof value !== 'object' || value === null || !('input' in value)) {
        return { ok: false, error: `Line ${index + 1} has no "input" field.` };
      }
      const record = value as { input: unknown; expected?: unknown };
      items.push({ input: asItemInput(record.input), expected: record.expected ?? null });
    } catch {
      return { ok: false, error: `Line ${index + 1} is not valid JSON.` };
    }
  }

  return { ok: true, items };
}

export function parseDatasetFile(fileName: string, text: string): ImportResult {
  const result = fileName.toLowerCase().endsWith('.csv') ? fromCsv(text) : fromJsonl(text);
  if (!result.ok) return result;
  const items = result.items.filter(({ input }) => input !== null);
  if (items.length === 0) return { ok: false, error: 'The file has no items.' };
  if (items.length > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      error: `Import up to ${MAX_IMPORT_ROWS.toLocaleString('en-US')} items at a time.`,
    };
  }

  return { ok: true, items };
}

const PREVIEW_KEYS = ['message', 'answer', 'text', 'input', 'query'];

export function previewValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record);
    const key = keys.length === 1 ? keys[0] : PREVIEW_KEYS.find((candidate) => candidate in record);
    const preview = key ? record[key] : undefined;
    if (typeof preview === 'string') return preview;
  }

  return JSON.stringify(value);
}

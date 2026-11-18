import { describe, expect, it } from 'vitest';
import { parseDatasetFile, previewValue } from './dataset-import';

describe('parseDatasetFile', () => {
  it('reads CSV with input and expected columns, parsing JSON cells', () => {
    const csv =
      'input,expected\n"Where is my order?","Ask for the email"\n"{""message"":""Refund""}",\n';

    const result = parseDatasetFile('cases.csv', csv);

    expect(result).toEqual({
      ok: true,
      items: [
        { input: { message: 'Where is my order?' }, expected: 'Ask for the email' },
        { input: { message: 'Refund' }, expected: null },
      ],
    });
  });

  it('requires an input column in CSV', () => {
    expect(parseDatasetFile('cases.csv', 'question\nhi')).toEqual({
      ok: false,
      error: 'The CSV needs an "input" column.',
    });
  });

  it('reads JSONL and reports the broken line', () => {
    expect(parseDatasetFile('cases.jsonl', '{"input":"hi","expected":"hello"}\n')).toEqual({
      ok: true,
      items: [{ input: { message: 'hi' }, expected: 'hello' }],
    });
    expect(parseDatasetFile('cases.jsonl', '{"input":"hi"}\nnot json')).toEqual({
      ok: false,
      error: 'Line 2 is not valid JSON.',
    });
  });
});

describe('previewValue', () => {
  it('shows the main text field of an item', () => {
    expect(previewValue({ message: 'Charged twice' })).toBe('Charged twice');
    expect(previewValue({ answer: 'Refund', confidence: 0.9 })).toBe('Refund');
    expect(previewValue({ a: 1, b: 2 })).toBe('{"a":1,"b":2}');
  });
});

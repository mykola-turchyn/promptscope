import { describe, expect, it } from 'vitest';
import { spanMessages } from './messages';
import { flattenSpanTree, timelineTicks } from './span-tree';

const at = (seconds: number) => new Date(seconds * 1000);
const span = (id: string, parentId: string | null, start: number) => ({
  id,
  parentId,
  startedAt: at(start),
  endedAt: at(start + 1),
});

describe('flattenSpanTree', () => {
  it('orders spans depth-first by start time and records depth', () => {
    const flat = flattenSpanTree([
      span('tool', 'root', 5),
      span('http', 'tool', 6),
      span('root', null, 0),
      span('plan', 'root', 1),
      span('orphan', 'missing', 3),
    ]);

    expect(flat.map(({ id, depth }) => `${id}:${depth}`)).toEqual([
      'root:0',
      'plan:1',
      'tool:1',
      'http:2',
      'orphan:0',
    ]);
  });
});

describe('timelineTicks', () => {
  it('picks a readable step', () => {
    expect(timelineTicks(18_400)).toEqual([0, 5_000, 10_000, 15_000]);
    expect(timelineTicks(600)).toEqual([0, 200, 400]);
  });
});

describe('spanMessages', () => {
  it('shows a chat by role, including tool calls', () => {
    const blocks = spanMessages({
      type: 'llm',
      input: {
        messages: [
          { role: 'system', content: 'Refund only duplicates.' },
          { role: 'user', content: 'Charged twice' },
        ],
      },
      output: {
        role: 'assistant',
        tool_calls: [{ name: 'issue_refund', arguments: { charge_id: 'ch_A2' } }],
      },
      error: null,
    });

    expect(blocks.map(({ role }) => role)).toEqual(['System', 'User', 'Assistant · tool call']);
    expect(blocks[2]?.text).toContain('issue_refund(');
  });

  it('labels tool spans and appends errors', () => {
    const blocks = spanMessages({
      type: 'tool',
      input: { charge_id: 'ch_A2' },
      output: null,
      error: 'TimeoutError',
    });

    expect(blocks.map(({ role }) => role)).toEqual(['Arguments', 'Error']);
  });

  it('reads Anthropic content blocks as text', () => {
    const blocks = spanMessages({
      type: 'llm',
      input: { query: 'refund policy' },
      output: { role: 'assistant', content: [{ type: 'text', text: 'Hello' }] },
      error: null,
    });

    expect(blocks.map(({ role, text }) => ({ role, text }))).toEqual([
      { role: 'Input', text: 'refund policy' },
      { role: 'Assistant', text: 'Hello' },
    ]);
  });
});

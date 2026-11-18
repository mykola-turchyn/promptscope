import { describe, expect, it } from 'vitest';
import { ingestBatchSchema } from './events.ts';

const span = {
  type: 'span',
  id: 'sp_1',
  traceId: 'tr_1',
  name: 'llm.plan',
  spanType: 'llm',
  model: 'claude-sonnet-4-5',
  usage: { input: 10, output: 5 },
  startedAt: '2026-11-17T10:00:00.000Z',
  endedAt: '2026-11-17T10:00:01.000Z',
};

describe('ingestBatchSchema', () => {
  it('accepts spans and fills defaults', () => {
    const parsed = ingestBatchSchema.parse({ events: [span] });

    expect(parsed.events[0]).toMatchObject({ status: 'ok', metadata: {} });
  });

  it('rejects unknown event types and empty batches', () => {
    expect(ingestBatchSchema.safeParse({ events: [] }).success).toBe(false);
    expect(ingestBatchSchema.safeParse({ events: [{ ...span, type: 'log' }] }).success).toBe(false);
  });
});

import type { IngestEvent } from '@promptscope/shared';
import { describe, expect, it } from 'vitest';
import { priceBookFrom } from '../prices.ts';
import { toBatchRows } from './transform.ts';

const prices = priceBookFrom([
  { model: 'claude-sonnet-4-5', inputPer1m: 3, outputPer1m: 15, validFrom: new Date('2025-01-01') },
]);

const span = (overrides: Partial<Extract<IngestEvent, { type: 'span' }>> = {}): IngestEvent => ({
  type: 'span',
  id: 'sp_1',
  traceId: 'tr_1',
  parentId: null,
  name: 'llm.answer',
  spanType: 'llm',
  model: 'claude-sonnet-4-5',
  usage: { input: 1_000_000, output: 0 },
  metadata: {},
  status: 'ok',
  startedAt: '2026-11-17T10:00:00.000Z',
  endedAt: '2026-11-17T10:00:02.500Z',
  ...overrides,
});

describe('toBatchRows', () => {
  it('prices spans on the server and computes latency', () => {
    const rows = toBatchRows('p1', [span()], prices);

    expect(rows.spans[0]).toMatchObject({ cost: 3, latencyMs: 2500, projectId: 'p1' });
  });

  it('leaves cost empty for unknown models', () => {
    const rows = toBatchRows('p1', [span({ model: 'llama-3' })], prices);

    expect(rows.spans[0]?.cost).toBeNull();
  });

  it('adds a placeholder trace for spans whose trace has not arrived yet', () => {
    const rows = toBatchRows(
      'p1',
      [span({ id: 'sp_child', parentId: 'sp_root' }), span({ id: 'sp_root', name: 'agent.run' })],
      prices,
    );

    expect(rows.stubTraces).toEqual([
      expect.objectContaining({ id: 'tr_1', name: 'agent.run', projectId: 'p1' }),
    ]);
  });

  it('keeps one row per retried event and drops malformed prompt version ids', () => {
    const trace: IngestEvent = {
      type: 'trace',
      id: 'tr_1',
      name: 'support.answer',
      environment: 'production',
      tags: [],
      metadata: {},
      status: 'ok',
      promptVersionId: 'not-a-uuid',
      startedAt: '2026-11-17T10:00:00.000Z',
      endedAt: '2026-11-17T10:00:03.000Z',
    };
    const rows = toBatchRows('p1', [span(), span(), trace], prices);

    expect(rows.spans).toHaveLength(1);
    expect(rows.stubTraces).toHaveLength(0);
    expect(rows.traces[0]?.promptVersionId).toBeNull();
    expect(rows.traceIds).toEqual(['tr_1']);
  });
});

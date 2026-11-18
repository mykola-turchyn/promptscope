import type { schema } from '@promptscope/db';
import {
  type IngestEvent,
  newId,
  type ScoreEvent,
  type SpanEvent,
  type TraceEvent,
} from '@promptscope/shared';
import type { PriceBook } from '../prices.ts';

type TraceRow = typeof schema.traces.$inferInsert;
type SpanRow = typeof schema.spans.$inferInsert;
type ScoreRow = typeof schema.scores.$inferInsert;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNKNOWN_TRACE_NAME = 'unnamed trace';

export interface BatchRows {
  traces: TraceRow[];
  stubTraces: TraceRow[];
  spans: SpanRow[];
  scores: ScoreRow[];
  traceIds: string[];
  promptVersionIds: string[];
}

function isType<T extends IngestEvent['type']>(type: T) {
  return (event: IngestEvent): event is Extract<IngestEvent, { type: T }> => event.type === type;
}

function lastById<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

export function traceRow(projectId: string, event: TraceEvent): TraceRow {
  const startedAt = new Date(event.startedAt);
  const endedAt = new Date(event.endedAt);
  const promptVersionId =
    event.promptVersionId && UUID_PATTERN.test(event.promptVersionId)
      ? event.promptVersionId
      : null;

  return {
    id: event.id,
    projectId,
    name: event.name,
    userId: event.userId ?? null,
    sessionId: event.sessionId ?? null,
    environment: event.environment,
    tags: event.tags,
    promptVersionId,
    input: event.input ?? null,
    output: event.output ?? null,
    metadata: event.metadata,
    status: event.status,
    startedAt,
    endedAt,
    latencyMs: endedAt.getTime() - startedAt.getTime(),
  };
}

export function spanRow(projectId: string, event: SpanEvent, prices: PriceBook): SpanRow {
  const startedAt = new Date(event.startedAt);
  const endedAt = new Date(event.endedAt);

  return {
    id: event.id,
    traceId: event.traceId,
    projectId,
    parentId: event.parentId ?? null,
    name: event.name,
    type: event.spanType,
    model: event.model ?? null,
    input: event.input ?? null,
    output: event.output ?? null,
    metadata: event.metadata,
    tokensIn: event.usage?.input ?? null,
    tokensOut: event.usage?.output ?? null,
    cost: prices.cost(event.model, event.usage, startedAt),
    startedAt,
    endedAt,
    latencyMs: Math.max(0, endedAt.getTime() - startedAt.getTime()),
    status: event.status,
    error: event.error ?? null,
  };
}

function scoreRow(projectId: string, event: ScoreEvent): ScoreRow {
  return {
    id: event.id || newId('score'),
    projectId,
    traceId: event.traceId,
    spanId: event.spanId ?? null,
    name: event.name,
    value: event.value,
    source: 'api',
    comment: event.comment ?? null,
  };
}

// Spans can arrive before their trace (different batches), so each trace gets a placeholder row
// that the real trace event later fills in.
function stubTraceRows(
  projectId: string,
  spans: SpanRow[],
  knownTraceIds: Set<string>,
): TraceRow[] {
  const byTrace = new Map<string, SpanRow[]>();
  for (const span of spans) {
    if (knownTraceIds.has(span.traceId)) continue;
    byTrace.set(span.traceId, [...(byTrace.get(span.traceId) ?? []), span]);
  }

  return [...byTrace.entries()].map(([traceId, traceSpans]) => {
    const root = traceSpans.find((span) => !span.parentId) ?? traceSpans[0];
    const startedAt = new Date(Math.min(...traceSpans.map((span) => span.startedAt.getTime())));

    return { id: traceId, projectId, name: root?.name ?? UNKNOWN_TRACE_NAME, startedAt };
  });
}

export function toBatchRows(
  projectId: string,
  events: IngestEvent[],
  prices: PriceBook,
): BatchRows {
  const traces = lastById(events.filter(isType('trace'))).map((event) =>
    traceRow(projectId, event),
  );
  const spans = lastById(events.filter(isType('span'))).map((event) =>
    spanRow(projectId, event, prices),
  );
  const scores = lastById(events.filter(isType('score'))).map((event) =>
    scoreRow(projectId, event),
  );
  const knownTraceIds = new Set(traces.map(({ id }) => id));
  const traceIds = [...new Set([...knownTraceIds, ...spans.map(({ traceId }) => traceId)])];
  const promptVersionIds = [
    ...new Set(traces.flatMap(({ promptVersionId }) => (promptVersionId ? [promptVersionId] : []))),
  ];

  return {
    traces,
    stubTraces: stubTraceRows(projectId, spans, knownTraceIds),
    spans,
    scores,
    traceIds,
    promptVersionIds,
  };
}

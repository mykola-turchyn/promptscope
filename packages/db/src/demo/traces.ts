import { computeCost, findPrice, newId, type SpanType } from '@promptscope/shared';
import type { spans, traces } from '../schema/index.ts';
import {
  KB_DOCUMENTS,
  REFUND_REQUESTS,
  SUPPORT_ANSWERS,
  SUPPORT_QUESTIONS,
  SUPPORT_SYSTEM_PROMPT,
  TICKET_LABELS,
} from './catalog.ts';
import { DEFAULT_MODEL_PRICES } from './prices.ts';
import type { Random } from './random.ts';

type TraceRow = typeof traces.$inferInsert;
type SpanRow = typeof spans.$inferInsert;

export interface DemoTrace {
  trace: TraceRow;
  spans: SpanRow[];
}

export interface TraceContext {
  random: Random;
  projectId: string;
  startedAt: Date;
  promptVersionIds: { supportReply: string; refundAgent: string };
}

interface SpanInput {
  name: string;
  type: SpanType;
  durationMs: number;
  parentId?: string | null;
  model?: string;
  usage?: { input: number; output: number };
  input?: unknown;
  output?: unknown;
  error?: string;
  gapMs?: number;
}

const SESSION_ID_LENGTH = 8;

function costOf(model: string | undefined, usage: SpanInput['usage'], at: Date): number | null {
  if (!model || !usage) return null;
  const price = findPrice(DEFAULT_MODEL_PRICES, model, at);

  return price ? computeCost(usage, price) : null;
}

class TraceBuilder {
  readonly traceId = newId('trace');
  readonly spans: SpanRow[] = [];
  private cursor: number;

  constructor(
    private readonly context: TraceContext,
    private readonly startedAt: Date,
  ) {
    this.cursor = startedAt.getTime();
  }

  span(input: SpanInput): string {
    const id = newId('span');
    const start = this.cursor + (input.gapMs ?? 0);
    const end = start + Math.max(1, Math.round(input.durationMs));
    const startedAt = new Date(start);
    this.spans.push({
      id,
      traceId: this.traceId,
      projectId: this.context.projectId,
      parentId: input.parentId ?? null,
      name: input.name,
      type: input.type,
      model: input.model ?? null,
      input: input.input ?? null,
      output: input.output ?? null,
      tokensIn: input.usage?.input ?? null,
      tokensOut: input.usage?.output ?? null,
      cost: costOf(input.model, input.usage, startedAt),
      startedAt,
      endedAt: new Date(end),
      latencyMs: end - start,
      status: input.error ? 'error' : 'ok',
      error: input.error ?? null,
    });
    this.cursor = end;

    return id;
  }

  wrap(rootId: string) {
    const root = this.spans.find((span) => span.id === rootId);
    const last = this.spans.at(-1);
    if (!root || !last) return;
    root.endedAt = last.endedAt;
    root.latencyMs = last.endedAt.getTime() - root.startedAt.getTime();
  }

  build(trace: Omit<TraceRow, 'id' | 'projectId' | 'startedAt'>): DemoTrace {
    const endedAt = new Date(
      Math.max(this.startedAt.getTime(), ...this.spans.map((span) => span.endedAt.getTime())),
    );
    const llmSpans = this.spans.filter((span) => span.model);

    return {
      trace: {
        id: this.traceId,
        projectId: this.context.projectId,
        startedAt: this.startedAt,
        endedAt,
        latencyMs: endedAt.getTime() - this.startedAt.getTime(),
        totalCost: this.spans.reduce((sum, span) => sum + (span.cost ?? 0), 0),
        totalTokensIn: this.spans.reduce((sum, span) => sum + (span.tokensIn ?? 0), 0),
        totalTokensOut: this.spans.reduce((sum, span) => sum + (span.tokensOut ?? 0), 0),
        spanCount: this.spans.length,
        models: modelsByCost(llmSpans),
        status: this.spans.some((span) => span.status === 'error') ? 'error' : 'ok',
        ...trace,
      },
      spans: this.spans,
    };
  }
}

function modelsByCost(spans: SpanRow[]): string[] {
  const costs = new Map<string, number>();
  for (const span of spans) {
    if (span.model) costs.set(span.model, (costs.get(span.model) ?? 0) + (span.cost ?? 0));
  }

  return [...costs.entries()].sort((left, right) => right[1] - left[1]).map(([model]) => model);
}

function userId(random: Random): string {
  return `u_${String(random.int(1, 9999)).padStart(4, '0')}`;
}

function chat(system: string, user: string) {
  return {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };
}

function supportAnswer(context: TraceContext): DemoTrace {
  const { random } = context;
  const builder = new TraceBuilder(context, context.startedAt);
  const question = random.pick(SUPPORT_QUESTIONS);
  const answer = random.pick(SUPPORT_ANSWERS);
  const timedOut = random.chance(0.012);
  const query = question.text.toLowerCase().slice(0, 40);
  builder.span({
    name: 'kb.retrieve',
    type: 'retrieval',
    durationMs: random.normal(220, 40),
    model: 'text-embedding-3-small',
    usage: { input: random.int(30, 80), output: 0 },
    input: { query },
    output: { documents: KB_DOCUMENTS.slice(0, 3) },
  });
  const tokensIn = random.int(2400, 3600);
  builder.span({
    name: 'llm.answer',
    type: 'llm',
    durationMs: timedOut ? 30_000 : Math.max(900, random.normal(3300, 900)),
    model: 'claude-sonnet-4-5',
    usage: { input: tokensIn, output: timedOut ? 0 : random.int(300, 600) },
    input: chat(SUPPORT_SYSTEM_PROMPT.replace('{{company}}', 'Acme'), question.text),
    output: timedOut ? null : { role: 'assistant', content: answer },
    error: timedOut ? 'TimeoutError: model did not respond within 30 s' : undefined,
    gapMs: 20,
  });

  return builder.build({
    name: 'support.answer',
    userId: userId(random),
    sessionId: `s_${random.hex(SESSION_ID_LENGTH)}`,
    tags: [timedOut ? 'timeout' : question.tag],
    promptVersionId: context.promptVersionIds.supportReply,
    input: { message: question.text },
    output: timedOut ? null : { answer },
  });
}

function ticketClassify(context: TraceContext): DemoTrace {
  const { random } = context;
  const builder = new TraceBuilder(context, context.startedAt);
  const label = random.pick(TICKET_LABELS);
  const question = random.pick(SUPPORT_QUESTIONS);
  builder.span({
    name: 'llm.classify',
    type: 'llm',
    durationMs: Math.max(250, random.normal(550, 120)),
    model: 'gpt-4.1-mini',
    usage: { input: random.int(700, 900), output: random.int(18, 30) },
    input: chat(`Classify the ticket into one of: ${TICKET_LABELS.join(', ')}.`, question.text),
    output: { role: 'assistant', content: label },
  });

  return builder.build({
    name: 'ticket.classify',
    userId: 'system',
    tags: ['triage'],
    input: { ticket: question.text },
    output: { label },
  });
}

function ticketSummarize(context: TraceContext): DemoTrace {
  const { random } = context;
  const builder = new TraceBuilder(context, context.startedAt);
  const slow = random.chance(0.05);
  builder.span({
    name: 'llm.summarize',
    type: 'llm',
    durationMs: slow ? random.normal(13_000, 2_500) : Math.max(1500, random.normal(4_200, 900)),
    model: 'gpt-4.1',
    usage: { input: random.int(9_000, 15_000), output: random.int(400, 700) },
    input: chat(
      'Summarise the ticket thread in three bullet points.',
      'Ticket thread with 14 messages…',
    ),
    output: {
      role: 'assistant',
      content:
        '• Customer reports a duplicate charge\n• Agent confirmed and refunded\n• Customer asks for a receipt',
    },
  });

  return builder.build({
    name: 'ticket.summarize',
    userId: 'system',
    tags: ['triage'],
    input: { ticketId: `T-${random.int(20_000, 29_999)}` },
  });
}

function refundFlow(context: TraceContext): DemoTrace {
  const { random } = context;
  const builder = new TraceBuilder(context, context.startedAt);
  const request = random.pick(REFUND_REQUESTS);
  const failed = random.chance(0.08);
  const orderId = String(random.int(50_000, 79_999));
  const rootId = builder.span({
    name: 'agent.refund-flow',
    type: 'agent',
    durationMs: 1,
    input: { ticket_id: `T-${random.int(20_000, 29_999)}`, message: request },
  });
  builder.span({
    name: 'kb.retrieve',
    type: 'retrieval',
    parentId: rootId,
    durationMs: random.normal(300, 50),
    model: 'text-embedding-3-small',
    usage: { input: 41, output: 0 },
    input: { query: 'charged twice refund policy' },
    output: { documents: KB_DOCUMENTS.slice(0, 3) },
    gapMs: 100,
  });
  builder.span({
    name: 'llm.plan',
    type: 'llm',
    parentId: rootId,
    durationMs: random.normal(4_400, 700),
    model: 'claude-sonnet-4-5',
    usage: { input: random.int(8_000, 11_000), output: random.int(500, 700) },
    input: chat('You are a support agent for Acme. Plan the steps before acting.', request),
    output: {
      role: 'assistant',
      content: `Plan: 1) look up order #${orderId}, 2) confirm duplicate charge, 3) refund the second charge, 4) reply to the customer.`,
    },
  });
  builder.span({
    name: 'tool.get_order',
    type: 'tool',
    parentId: rootId,
    durationMs: random.normal(600, 100),
    input: { order_id: orderId },
    output: {
      status: 'delivered',
      charges: [
        { id: 'ch_A1', amount: 49 },
        { id: 'ch_A2', amount: 49 },
      ],
    },
    gapMs: 100,
  });
  builder.span({
    name: 'llm.decide',
    type: 'llm',
    parentId: rootId,
    durationMs: random.normal(5_400, 900),
    model: 'claude-sonnet-4-5',
    usage: { input: random.int(16_000, 20_000), output: random.int(1_200, 1_600) },
    input: chat(
      'You are a support agent for Acme. Refund only duplicate charges. Always confirm the amount before calling issue_refund.',
      request,
    ),
    output: {
      role: 'assistant',
      tool_calls: [
        {
          name: 'issue_refund',
          arguments: { charge_id: 'ch_A2', amount: 49, reason: 'duplicate_charge' },
        },
      ],
    },
    gapMs: 100,
  });
  const refundId = builder.span({
    name: 'tool.issue_refund',
    type: 'tool',
    parentId: rootId,
    durationMs: 1,
    input: { charge_id: 'ch_A2', amount: 49 },
    output: failed ? null : { refund_id: `re_${random.hex(8)}`, status: 'succeeded' },
    error: failed ? 'TimeoutError: POST /v1/refunds exceeded 7000 ms, attempt 3 of 3' : undefined,
    gapMs: 100,
  });
  builder.span({
    name: 'POST /v1/refunds',
    type: 'http',
    parentId: refundId,
    durationMs: failed ? 6_900 : random.normal(800, 150),
    input: { url: 'https://payments.internal/v1/refunds', method: 'POST' },
    output: failed ? null : { status: 200 },
    error: failed ? 'no response (timeout)' : undefined,
  });
  builder.wrap(refundId);
  builder.wrap(rootId);

  return builder.build({
    name: 'agent.refund-flow',
    userId: userId(random),
    tags: ['refunds'],
    promptVersionId: context.promptVersionIds.refundAgent,
    input: { message: request },
  });
}

function knowledgeIngest(context: TraceContext): DemoTrace {
  const { random } = context;
  const builder = new TraceBuilder(context, context.startedAt);
  const chunkCount = random.int(30, 40);
  for (let index = 0; index < chunkCount; index += 1) {
    builder.span({
      name: `embed.chunk-${index + 1}`,
      type: 'retrieval',
      durationMs: random.normal(400, 80),
      model: 'text-embedding-3-small',
      usage: { input: random.int(600, 900), output: 0 },
    });
  }
  builder.span({
    name: 'llm.extract-faq',
    type: 'llm',
    durationMs: random.normal(25_000, 3_000),
    model: 'gpt-4.1',
    usage: { input: random.int(60_000, 80_000), output: random.int(3_000, 5_000) },
  });

  return builder.build({ name: 'kb.ingest-batch', userId: 'system', tags: ['search'] });
}

const TRACE_MIX: Array<{ weight: number; build: (context: TraceContext) => DemoTrace }> = [
  { weight: 0.58, build: supportAnswer },
  { weight: 0.26, build: ticketClassify },
  { weight: 0.12, build: ticketSummarize },
  { weight: 0.037, build: refundFlow },
  { weight: 0.003, build: knowledgeIngest },
];

export function buildDemoTrace(context: TraceContext): DemoTrace {
  let roll = context.random.next();
  for (const entry of TRACE_MIX) {
    roll -= entry.weight;
    if (roll <= 0) return entry.build(context);
  }

  return supportAnswer(context);
}

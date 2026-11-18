import { z } from 'zod';

export const MAX_EVENTS_PER_BATCH = 500;
const MAX_NAME_LENGTH = 200;
const MAX_TAGS = 20;

export const SPAN_TYPES = ['llm', 'tool', 'retrieval', 'agent', 'http', 'custom'] as const;
export const spanTypeSchema = z.enum(SPAN_TYPES);
export type SpanType = z.infer<typeof spanTypeSchema>;

export const RUN_STATUSES = ['ok', 'error'] as const;
export const runStatusSchema = z.enum(RUN_STATUSES);
export type RunStatus = z.infer<typeof runStatusSchema>;

const idSchema = z.string().min(1).max(64);
const nameSchema = z.string().min(1).max(MAX_NAME_LENGTH);
const timestampSchema = z.iso.datetime({ offset: true });
const jsonSchema = z.json();
export type JsonValue = z.infer<typeof jsonSchema>;

export const traceEventSchema = z.object({
  type: z.literal('trace'),
  id: idSchema,
  name: nameSchema,
  userId: z.string().max(MAX_NAME_LENGTH).nullish(),
  sessionId: z.string().max(MAX_NAME_LENGTH).nullish(),
  environment: z.string().max(64).default('production'),
  tags: z.array(z.string().max(64)).max(MAX_TAGS).default([]),
  promptVersionId: z.string().max(64).nullish(),
  input: jsonSchema.optional(),
  output: jsonSchema.optional(),
  metadata: z.record(z.string(), jsonSchema).default({}),
  status: runStatusSchema.default('ok'),
  startedAt: timestampSchema,
  endedAt: timestampSchema,
});
export type TraceEvent = z.infer<typeof traceEventSchema>;

export const usageSchema = z.object({
  input: z.number().int().nonnegative(),
  output: z.number().int().nonnegative(),
});
export type Usage = z.infer<typeof usageSchema>;

export const spanEventSchema = z.object({
  type: z.literal('span'),
  id: idSchema,
  traceId: idSchema,
  parentId: idSchema.nullish(),
  name: nameSchema,
  spanType: spanTypeSchema.default('custom'),
  model: z.string().max(MAX_NAME_LENGTH).nullish(),
  input: jsonSchema.optional(),
  output: jsonSchema.optional(),
  metadata: z.record(z.string(), jsonSchema).default({}),
  usage: usageSchema.nullish(),
  status: runStatusSchema.default('ok'),
  error: z.string().max(10_000).nullish(),
  startedAt: timestampSchema,
  endedAt: timestampSchema,
});
export type SpanEvent = z.infer<typeof spanEventSchema>;

export const scoreEventSchema = z.object({
  type: z.literal('score'),
  id: idSchema,
  traceId: idSchema,
  spanId: idSchema.nullish(),
  name: nameSchema,
  value: z.number(),
  comment: z.string().max(2_000).nullish(),
});
export type ScoreEvent = z.infer<typeof scoreEventSchema>;

export const ingestEventSchema = z.discriminatedUnion('type', [
  traceEventSchema,
  spanEventSchema,
  scoreEventSchema,
]);
export type IngestEvent = z.infer<typeof ingestEventSchema>;
export type IngestEventInput = z.input<typeof ingestEventSchema>;

export const ingestBatchSchema = z.object({
  events: z.array(ingestEventSchema).min(1).max(MAX_EVENTS_PER_BATCH),
});
export type IngestBatch = z.infer<typeof ingestBatchSchema>;

export interface IngestJob {
  projectId: string;
  receivedAt: string;
  events: IngestEvent[];
}

export const INGEST_QUEUE = 'ingest';
export const INGEST_DEAD_LETTER_QUEUE = 'ingest-dead-letter';
export const EVAL_QUEUE = 'eval-runs';

export interface EvalJob {
  runId: string;
}

export function projectChannel(projectId: string): string {
  return `ps:project:${projectId}:events`;
}

export const promptResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.number().int(),
  template: z.string(),
  variables: z.array(z.string()),
  labels: z.array(z.string()),
  modelConfig: z.record(z.string(), jsonSchema),
});
export type PromptResponse = z.infer<typeof promptResponseSchema>;

export type SpanType = 'llm' | 'tool' | 'retrieval' | 'agent' | 'http' | 'custom';
export type RunStatus = 'ok' | 'error';

export interface Usage {
  input: number;
  output: number;
}

export interface PromptscopeOptions {
  /** Defaults to the PROMPTSCOPE_API_KEY environment variable. */
  apiKey?: string;
  /** Ingest API URL. Defaults to PROMPTSCOPE_BASE_URL or http://localhost:4318. */
  baseUrl?: string;
  environment?: string;
  /** Send a batch once this many events are buffered. */
  flushAt?: number;
  /** Send buffered events at least this often. */
  flushIntervalMs?: number;
  maxRetries?: number;
  /** Runs on every input, output and metadata value before it leaves the process. */
  mask?: (data: unknown) => unknown;
  debug?: boolean;
  enabled?: boolean;
  fetch?: typeof fetch;
}

export interface PromptVersion {
  id: string;
  name: string;
  version: number;
  template: string;
  variables: string[];
  labels: string[];
  modelConfig: Record<string, unknown>;
  compile(values: Record<string, unknown>): string;
}

export interface TraceOptions {
  userId?: string;
  sessionId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  input?: unknown;
  prompt?: Pick<PromptVersion, 'id'>;
}

export interface SpanOptions {
  type?: SpanType;
  model?: string;
  input?: unknown;
  metadata?: Record<string, unknown>;
}

export interface TraceHandle {
  readonly id: string;
  update(
    values: Pick<TraceOptions, 'userId' | 'sessionId' | 'tags' | 'metadata'> & { output?: unknown },
  ): void;
}

export interface SpanHandle {
  readonly id: string;
  readonly traceId: string;
  setOutput(output: unknown): void;
  setUsage(usage: Usage): void;
  setModel(model: string): void;
  setMetadata(metadata: Record<string, unknown>): void;
}

export interface GetPromptOptions {
  label?: string;
  version?: number;
  /** Used when the server is unreachable and no version was fetched before. */
  fallback?: Omit<PromptVersion, 'compile'>;
  cacheTtlMs?: number;
}

export interface ScoreInput {
  traceId?: string;
  spanId?: string;
  name: string;
  value: number;
  comment?: string;
}

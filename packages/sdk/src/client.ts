import type { IngestEventInput, JsonValue } from '@promptscope/shared/events';
import { newId } from '@promptscope/shared/ids';
import { renderTemplate } from '@promptscope/shared/templates';
import { contextStorage, currentContext } from './context.ts';
import { createLogger, type Logger } from './logger.ts';
import { Transport } from './transport.ts';
import type {
  GetPromptOptions,
  PromptscopeOptions,
  PromptVersion,
  RunStatus,
  ScoreInput,
  SpanHandle,
  SpanOptions,
  SpanType,
  TraceHandle,
  TraceOptions,
  Usage,
} from './types.ts';

const DEFAULT_BASE_URL = 'http://localhost:4318';
const DEFAULT_FLUSH_AT = 100;
const DEFAULT_FLUSH_INTERVAL_MS = 2_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_PROMPT_CACHE_TTL_MS = 60_000;
const DEFAULT_ENVIRONMENT = 'production';

interface CachedPrompt {
  prompt: PromptVersion;
  fetchedAt: number;
}

export interface ActiveSpan extends SpanHandle {
  end(result?: { output?: unknown; usage?: Usage; error?: unknown }): void;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;

  return String(error);
}

function withCompile(prompt: Omit<PromptVersion, 'compile'>): PromptVersion {
  return { ...prompt, compile: (values) => renderTemplate(prompt.template, values) };
}

export class Promptscope {
  private static defaultInstance: Promptscope | undefined;

  private readonly transport: Transport | undefined;
  private readonly logger: Logger;
  private readonly environment: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly mask: (data: unknown) => unknown;
  private readonly promptCache = new Map<string, CachedPrompt>();

  constructor(options: PromptscopeOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.PROMPTSCOPE_API_KEY ?? '';
    this.baseUrl = (
      options.baseUrl ??
      process.env.PROMPTSCOPE_BASE_URL ??
      DEFAULT_BASE_URL
    ).replace(/\/$/, '');
    this.environment = options.environment ?? DEFAULT_ENVIRONMENT;
    this.logger = createLogger(options.debug ?? false);
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.mask = options.mask ?? ((data) => data);
    const enabled = (options.enabled ?? true) && this.apiKey !== '';
    if (!enabled) this.logger.debug('Tracing is disabled: no API key');
    this.transport = enabled
      ? new Transport({
          apiKey: this.apiKey,
          baseUrl: this.baseUrl,
          flushAt: options.flushAt ?? DEFAULT_FLUSH_AT,
          flushIntervalMs: options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS,
          maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
          fetch: this.fetchImpl,
          logger: this.logger,
        })
      : undefined;
    Promptscope.defaultInstance = this;
  }

  static get default(): Promptscope | undefined {
    return Promptscope.defaultInstance;
  }

  async trace<T>(
    name: string,
    fn: (trace: TraceHandle) => T | Promise<T>,
    options: TraceOptions = {},
  ): Promise<T> {
    const id = newId('trace');
    const startedAt = new Date();
    const state = { ...options, output: undefined as unknown };
    const handle: TraceHandle = {
      id,
      update: (values) => Object.assign(state, values),
    };
    let status: RunStatus = 'ok';
    try {
      const result = await contextStorage.run({ traceId: id, spanId: null }, () => fn(handle));
      if (state.output === undefined) state.output = result;

      return result;
    } catch (error) {
      status = 'error';
      throw error;
    } finally {
      this.emit(() => ({
        type: 'trace',
        id,
        name,
        userId: state.userId,
        sessionId: state.sessionId,
        environment: this.environment,
        tags: state.tags ?? [],
        promptVersionId: state.prompt?.id,
        input: this.safeJson(state.input),
        output: this.safeJson(state.output),
        metadata: this.safeRecord(state.metadata),
        status,
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
      }));
    }
  }

  async span<T>(
    name: string,
    fn: (span: SpanHandle) => T | Promise<T>,
    options: SpanOptions = {},
  ): Promise<T> {
    if (!currentContext()) {
      return this.trace(name, () => this.span(name, fn, options));
    }
    const span = this.startSpan(name, options);
    try {
      const result = await contextStorage.run({ traceId: span.traceId, spanId: span.id }, () =>
        fn(span),
      );
      span.end({ output: result });

      return result;
    } catch (error) {
      span.end({ error });
      throw error;
    }
  }

  /** Low-level span API for work that outlives a callback, such as a streamed response. */
  startSpan(name: string, options: SpanOptions & { type?: SpanType } = {}): ActiveSpan {
    const context = currentContext();
    const traceId = context?.traceId ?? newId('trace');
    const isStandalone = !context;
    const id = newId('span');
    const startedAt = new Date();
    const state: {
      output?: unknown;
      usage?: Usage;
      model?: string;
      metadata?: Record<string, unknown>;
    } = { model: options.model, metadata: options.metadata };
    let ended = false;

    return {
      id,
      traceId,
      setOutput: (output) => {
        state.output = output;
      },
      setUsage: (usage) => {
        state.usage = usage;
      },
      setModel: (model) => {
        state.model = model;
      },
      setMetadata: (metadata) => {
        state.metadata = { ...state.metadata, ...metadata };
      },
      end: (result = {}) => {
        if (ended) return;
        ended = true;
        const endedAt = new Date().toISOString();
        const status: RunStatus = result.error === undefined ? 'ok' : 'error';
        const output = result.output ?? state.output;
        this.emit(() => ({
          type: 'span',
          id,
          traceId,
          parentId: context?.spanId ?? undefined,
          name,
          spanType: options.type ?? 'custom',
          model: state.model,
          input: this.safeJson(options.input),
          output: this.safeJson(output),
          metadata: this.safeRecord(state.metadata),
          usage: result.usage ?? state.usage,
          status,
          error: result.error === undefined ? undefined : errorMessage(result.error),
          startedAt: startedAt.toISOString(),
          endedAt,
        }));
        if (isStandalone) {
          this.emit(() => ({
            type: 'trace',
            id: traceId,
            name,
            environment: this.environment,
            input: this.safeJson(options.input),
            output: this.safeJson(output),
            status,
            startedAt: startedAt.toISOString(),
            endedAt,
          }));
        }
      },
    };
  }

  score(input: ScoreInput): void {
    const traceId = input.traceId ?? currentContext()?.traceId;
    if (!traceId) {
      this.logger.debug('score() needs a traceId outside of a trace');

      return;
    }
    this.emit(() => ({
      type: 'score',
      id: newId('score'),
      traceId,
      spanId: input.spanId,
      name: input.name,
      value: input.value,
      comment: input.comment,
    }));
  }

  async getPrompt(name: string, options: GetPromptOptions = {}): Promise<PromptVersion> {
    const label = options.version === undefined ? (options.label ?? 'production') : undefined;
    const cacheKey = `${name}:${label ?? `v${options.version}`}`;
    const cached = this.promptCache.get(cacheKey);
    const ttl = options.cacheTtlMs ?? DEFAULT_PROMPT_CACHE_TTL_MS;
    if (cached && Date.now() - cached.fetchedAt < ttl) return cached.prompt;

    try {
      const query = new URLSearchParams(
        label ? { label } : { version: String(options.version) },
      ).toString();
      const response = await this.fetchImpl(
        `${this.baseUrl}/v1/prompts/${encodeURIComponent(name)}?${query}`,
        { headers: { authorization: `Bearer ${this.apiKey}` } },
      );
      if (!response.ok) throw new Error(`Prompt request failed with ${response.status}`);
      const prompt = withCompile((await response.json()) as Omit<PromptVersion, 'compile'>);
      this.promptCache.set(cacheKey, { prompt, fetchedAt: Date.now() });

      return prompt;
    } catch (error) {
      this.logger.debug(`Could not fetch prompt ${name}, using the last known version`, error);
      if (cached) return cached.prompt;
      if (options.fallback) return withCompile(options.fallback);
      throw error;
    }
  }

  flush(): Promise<void> {
    return this.transport?.flush() ?? Promise.resolve();
  }

  shutdown(): Promise<void> {
    return this.flush();
  }

  private emit(build: () => IngestEventInput): void {
    if (!this.transport) return;
    try {
      this.transport.enqueue(build());
    } catch (error) {
      this.logger.debug('Could not record telemetry', error);
    }
  }

  private safeJson(value: unknown): JsonValue | undefined {
    if (value === undefined) return undefined;
    try {
      const masked = this.mask(value);

      return masked === undefined ? undefined : (JSON.parse(JSON.stringify(masked)) as JsonValue);
    } catch (error) {
      this.logger.debug('Dropped a value that is not JSON-serializable', error);

      return undefined;
    }
  }

  private safeRecord(value: Record<string, unknown> | undefined): Record<string, JsonValue> {
    const json = this.safeJson(value);

    return json && typeof json === 'object' && !Array.isArray(json) ? json : {};
  }
}

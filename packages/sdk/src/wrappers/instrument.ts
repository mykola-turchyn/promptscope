import type { ActiveSpan, Promptscope } from '../client.ts';
import { Promptscope as PromptscopeClient } from '../client.ts';
import type { Usage } from '../types.ts';
import { isRecord, readString } from './read.ts';

export interface CallResult {
  output: unknown;
  usage?: Usage;
  model?: string;
}

export interface StreamCollector {
  onChunk(chunk: unknown): void;
  result(): CallResult;
}

export interface MethodAdapter {
  spanName: string;
  input(params: Record<string, unknown>): unknown;
  result(response: unknown): CallResult;
  prepareStream?(params: Record<string, unknown>): Record<string, unknown>;
  collector(): StreamCollector;
}

export interface WrapOptions {
  promptscope?: Promptscope;
}

type AnyFunction = (...args: unknown[]) => unknown;

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return isRecord(value) || typeof value === 'function'
    ? typeof (value as { then?: unknown }).then === 'function'
    : false;
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] === 'function'
  );
}

function wrapStream<T extends object>(stream: T, collector: StreamCollector, span: ActiveSpan): T {
  if (!isAsyncIterable(stream)) {
    span.end({ output: stream });

    return stream;
  }
  async function* iterate() {
    try {
      for await (const chunk of stream as AsyncIterable<unknown>) {
        try {
          collector.onChunk(chunk);
        } catch {
          // A chunk we cannot read must never break the caller's stream.
        }
        yield chunk;
      }
    } catch (error) {
      span.end({ error, ...collector.result() });
      throw error;
    } finally {
      span.end(collector.result());
    }
  }

  return new Proxy(stream, {
    get(target, property) {
      if (property === Symbol.asyncIterator) return iterate;
      const value = Reflect.get(target, property, target);

      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

function instrument(
  original: AnyFunction,
  target: object,
  adapter: MethodAdapter,
  options: WrapOptions,
): AnyFunction {
  return (...args: unknown[]) => {
    const client = options.promptscope ?? PromptscopeClient.default;
    const params = isRecord(args[0]) ? args[0] : undefined;
    if (!client || !params) return original.apply(target, args);

    const isStream = params.stream === true;
    const callParams = isStream && adapter.prepareStream ? adapter.prepareStream(params) : params;
    let span: ActiveSpan;
    try {
      span = client.startSpan(adapter.spanName, {
        type: 'llm',
        model: readString(params, 'model'),
        input: adapter.input(params),
      });
    } catch {
      return original.apply(target, args);
    }

    let returned: unknown;
    try {
      returned = original.apply(target, [callParams, ...args.slice(1)]);
    } catch (error) {
      span.end({ error });
      throw error;
    }
    if (!isPromiseLike(returned)) {
      span.end({ output: returned });

      return returned;
    }
    if (!isStream) {
      returned.then(
        (response) => {
          const { model, ...result } = adapter.result(response);
          if (model) span.setModel(model);
          span.end(result);
        },
        (error: unknown) => span.end({ error }),
      );

      return returned;
    }

    return Promise.resolve(returned).then(
      (stream) => (isRecord(stream) ? wrapStream(stream, adapter.collector(), span) : stream),
      (error: unknown) => {
        span.end({ error });
        throw error;
      },
    );
  };
}

export function wrapClient<T extends object>(
  client: T,
  adapters: Record<string, MethodAdapter>,
  options: WrapOptions,
  path: string[] = [],
): T {
  const prefixes = Object.keys(adapters);

  return new Proxy(client, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof property !== 'string') return value;
      const key = [...path, property].join('.');
      const adapter = adapters[key];
      if (adapter && typeof value === 'function') {
        return instrument(value as AnyFunction, target, adapter, options);
      }
      if (
        value &&
        typeof value === 'object' &&
        prefixes.some((prefix) => prefix.startsWith(`${key}.`))
      ) {
        return wrapClient(value, adapters, options, [...path, property]);
      }

      return value;
    },
  });
}

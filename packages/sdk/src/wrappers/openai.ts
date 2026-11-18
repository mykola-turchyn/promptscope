import type { Usage } from '../types.ts';
import { type MethodAdapter, type WrapOptions, wrapClient } from './instrument.ts';
import { isRecord, read, readNumber, readString } from './read.ts';

function chatUsage(source: unknown): Usage | undefined {
  const input = readNumber(source, 'prompt_tokens');
  const output = readNumber(source, 'completion_tokens');

  return input === undefined || output === undefined ? undefined : { input, output };
}

function responsesUsage(source: unknown): Usage | undefined {
  const input = readNumber(source, 'input_tokens');
  const output = readNumber(source, 'output_tokens');

  return input === undefined || output === undefined ? undefined : { input, output };
}

const chatCompletions: MethodAdapter = {
  spanName: 'openai.chat.completions',
  input: (params) => ({ messages: params.messages }),
  result: (response) => ({
    output: read(response, 'choices', 0, 'message'),
    usage: chatUsage(read(response, 'usage')),
    model: readString(response, 'model'),
  }),
  prepareStream: (params) => ({
    ...params,
    stream_options: {
      ...(isRecord(params.stream_options) ? params.stream_options : {}),
      include_usage: true,
    },
  }),
  collector: () => {
    let content = '';
    let usage: Usage | undefined;
    let model: string | undefined;

    return {
      onChunk: (chunk) => {
        content += readString(chunk, 'choices', 0, 'delta', 'content') ?? '';
        usage = chatUsage(read(chunk, 'usage')) ?? usage;
        model = readString(chunk, 'model') ?? model;
      },
      result: () => ({ output: { role: 'assistant', content }, usage, model }),
    };
  },
};

const responses: MethodAdapter = {
  spanName: 'openai.responses',
  input: (params) => ({ input: params.input, instructions: params.instructions }),
  result: (response) => ({
    output: readString(response, 'output_text') ?? read(response, 'output'),
    usage: responsesUsage(read(response, 'usage')),
    model: readString(response, 'model'),
  }),
  collector: () => {
    let content = '';
    let usage: Usage | undefined;

    return {
      onChunk: (event) => {
        if (readString(event, 'type') === 'response.output_text.delta') {
          content += readString(event, 'delta') ?? '';
        }
        usage = responsesUsage(read(event, 'response', 'usage')) ?? usage;
      },
      result: () => ({ output: content, usage }),
    };
  },
};

export function wrapOpenAI<T extends object>(client: T, options: WrapOptions = {}): T {
  return wrapClient(
    client,
    { 'chat.completions.create': chatCompletions, 'responses.create': responses },
    options,
  );
}

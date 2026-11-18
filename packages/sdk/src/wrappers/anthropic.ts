import type { Usage } from '../types.ts';
import { type MethodAdapter, type WrapOptions, wrapClient } from './instrument.ts';
import { read, readNumber, readString } from './read.ts';

function messageUsage(source: unknown): Usage | undefined {
  const input = readNumber(source, 'input_tokens');
  const output = readNumber(source, 'output_tokens');

  return input === undefined || output === undefined ? undefined : { input, output };
}

const messages: MethodAdapter = {
  spanName: 'anthropic.messages',
  input: (params) => ({ system: params.system, messages: params.messages }),
  result: (response) => ({
    output: { role: 'assistant', content: read(response, 'content') },
    usage: messageUsage(read(response, 'usage')),
    model: readString(response, 'model'),
  }),
  collector: () => {
    let content = '';
    let input = 0;
    let output = 0;
    let model: string | undefined;

    return {
      onChunk: (event) => {
        switch (readString(event, 'type')) {
          case 'message_start':
            input = readNumber(event, 'message', 'usage', 'input_tokens') ?? input;
            model = readString(event, 'message', 'model') ?? model;
            break;
          case 'content_block_delta':
            content += readString(event, 'delta', 'text') ?? '';
            break;
          case 'message_delta':
            output = readNumber(event, 'usage', 'output_tokens') ?? output;
            break;
        }
      },
      result: () => ({ output: { role: 'assistant', content }, usage: { input, output }, model }),
    };
  },
};

export function wrapAnthropic<T extends object>(client: T, options: WrapOptions = {}): T {
  return wrapClient(client, { 'messages.create': messages }, options);
}

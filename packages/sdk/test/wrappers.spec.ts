import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Promptscope, wrapAnthropic, wrapOpenAI } from '../src/index.ts';
import { BASE_URL, eventsOfType, received, server } from './server.ts';

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  received.length = 0;
});
afterAll(() => server.close());

async function* chunks<T>(items: T[]) {
  for (const item of items) yield item;
}

interface ChatParams {
  model: string;
  messages?: unknown[];
  stream?: boolean;
}

interface ChatCompletion {
  model: string;
  choices: Array<{ message: { role: string; content: string } }>;
  usage: { prompt_tokens: number; completion_tokens: number };
}

interface ChatChunk {
  model?: string;
  choices: Array<{ delta?: { content?: string } }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

function fakeOpenAI() {
  const calls: Array<Record<string, unknown>> = [];
  function create(params: ChatParams & { stream: true }): Promise<AsyncIterable<ChatChunk>>;
  function create(params: ChatParams & { stream?: false }): Promise<ChatCompletion>;
  async function create(params: ChatParams): Promise<AsyncIterable<ChatChunk> | ChatCompletion> {
    calls.push({ ...params });
    if (params.stream) {
      return chunks<ChatChunk>([
        { model: 'gpt-4.1-mini', choices: [{ delta: { content: 'Hel' } }] },
        { model: 'gpt-4.1-mini', choices: [{ delta: { content: 'lo' } }] },
        { choices: [], usage: { prompt_tokens: 12, completion_tokens: 2 } },
      ]);
    }

    return {
      model: 'gpt-4.1-mini-2025-04-14',
      choices: [{ message: { role: 'assistant', content: 'Hello' } }],
      usage: { prompt_tokens: 10, completion_tokens: 3 },
    };
  }

  return { client: { apiKey: 'sk-test', chat: { completions: { create } } }, calls };
}

describe('wrapOpenAI', () => {
  it('records a span with usage and keeps the original result', async () => {
    const ps = new Promptscope({ apiKey: 'ps_live_test', baseUrl: BASE_URL });
    const { client } = fakeOpenAI();
    const openai = wrapOpenAI(client);

    const response = await ps.trace('support.answer', () =>
      openai.chat.completions.create({ model: 'gpt-4.1-mini', messages: [] }),
    );
    await ps.flush();

    expect(response.choices[0]?.message.content).toBe('Hello');
    expect(openai.apiKey).toBe('sk-test');
    expect(eventsOfType('span')[0]).toMatchObject({
      name: 'openai.chat.completions',
      spanType: 'llm',
      model: 'gpt-4.1-mini-2025-04-14',
      usage: { input: 10, output: 3 },
    });
  });

  it('counts tokens after a stream finishes and asks OpenAI for usage', async () => {
    const ps = new Promptscope({ apiKey: 'ps_live_test', baseUrl: BASE_URL });
    const { client, calls } = fakeOpenAI();
    const openai = wrapOpenAI(client);

    let text = '';
    await ps.trace('stream', async () => {
      const stream = await openai.chat.completions.create({ model: 'gpt-4.1-mini', stream: true });
      for await (const chunk of stream) {
        text += chunk.choices[0]?.delta?.content ?? '';
      }
    });
    await ps.flush();

    expect(text).toBe('Hello');
    expect(calls[0]?.stream_options).toEqual({ include_usage: true });
    expect(eventsOfType('span')[0]).toMatchObject({
      output: { role: 'assistant', content: 'Hello' },
      usage: { input: 12, output: 2 },
    });
  });
});

describe('wrapAnthropic', () => {
  it('collects text and usage from stream events', async () => {
    const ps = new Promptscope({ apiKey: 'ps_live_test', baseUrl: BASE_URL });
    const anthropic = wrapAnthropic({
      messages: {
        create: async (_params: { model: string; stream: boolean }) =>
          chunks([
            {
              type: 'message_start',
              message: { model: 'claude-sonnet-4-5', usage: { input_tokens: 40 } },
            },
            { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Refund ' } },
            { type: 'content_block_delta', delta: { type: 'text_delta', text: 'started' } },
            { type: 'message_delta', usage: { output_tokens: 5 } },
          ]),
      },
    });

    await ps.trace('refund', async () => {
      const stream = await anthropic.messages.create({ model: 'claude-sonnet-4-5', stream: true });
      for await (const _event of stream) {
        // drain
      }
    });
    await ps.flush();

    expect(eventsOfType('span')[0]).toMatchObject({
      name: 'anthropic.messages',
      model: 'claude-sonnet-4-5',
      output: { content: 'Refund started' },
      usage: { input: 40, output: 5 },
    });
  });
});

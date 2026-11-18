import Anthropic from '@anthropic-ai/sdk';
import { type Provider, providerForModel, type Usage } from '@promptscope/shared';
import OpenAI from 'openai';

const SDK_MAX_RETRIES = 4;

export interface CompletionRequest {
  provider?: Provider;
  model: string;
  system?: string;
  prompt: string;
  /** OpenAI only: the Anthropic Messages API no longer takes sampling parameters. */
  temperature: number;
  maxTokens: number;
}

export interface CompletionResponse {
  text: string;
  usage: Usage;
  latencyMs: number;
}

export interface LlmClient {
  complete(request: CompletionRequest): Promise<CompletionResponse>;
}

export function createLlmClient(keys: { openai?: string; anthropic?: string }): LlmClient {
  const openai = keys.openai
    ? new OpenAI({ apiKey: keys.openai, maxRetries: SDK_MAX_RETRIES })
    : null;
  const anthropic = keys.anthropic
    ? new Anthropic({ apiKey: keys.anthropic, maxRetries: SDK_MAX_RETRIES })
    : null;

  return {
    async complete(request) {
      const started = performance.now();
      const provider = providerForModel(request.model, request.provider);
      if (provider === 'anthropic') {
        if (!anthropic) throw new Error('ANTHROPIC_API_KEY is not set on the worker');
        const message = await anthropic.messages.create({
          model: request.model,
          max_tokens: request.maxTokens,
          system: request.system,
          messages: [{ role: 'user', content: request.prompt }],
        });
        const text = message.content
          .flatMap((block) => (block.type === 'text' ? [block.text] : []))
          .join('');

        return {
          text,
          usage: { input: message.usage.input_tokens, output: message.usage.output_tokens },
          latencyMs: Math.round(performance.now() - started),
        };
      }
      if (!openai) throw new Error('OPENAI_API_KEY is not set on the worker');
      const completion = await openai.chat.completions.create({
        model: request.model,
        max_completion_tokens: request.maxTokens,
        temperature: request.temperature,
        messages: [
          ...(request.system ? [{ role: 'system' as const, content: request.system }] : []),
          { role: 'user' as const, content: request.prompt },
        ],
      });

      return {
        text: completion.choices[0]?.message.content ?? '',
        usage: {
          input: completion.usage?.prompt_tokens ?? 0,
          output: completion.usage?.completion_tokens ?? 0,
        },
        latencyMs: Math.round(performance.now() - started),
      };
    },
  };
}

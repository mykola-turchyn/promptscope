import Anthropic from '@anthropic-ai/sdk';
import { wrapAnthropic, wrapOpenAI } from '@promptscope/sdk';
import OpenAI from 'openai';

const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-5-5';
const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';
const MAX_ANSWER_TOKENS = 16_000;
const REFUSAL_ANSWER = 'На жаль, я не можу допомогти з цим питанням. Передаю його оператору.';

export interface ChatModel {
  provider: 'anthropic' | 'openai';
  model: string;
  answer(system: string, question: string): Promise<string>;
}

function anthropicModel(model: string): ChatModel {
  const client = wrapAnthropic(new Anthropic());

  return {
    provider: 'anthropic',
    model,
    async answer(system, question) {
      const response = await client.messages.create({
        model,
        max_tokens: MAX_ANSWER_TOKENS,
        output_config: { effort: 'low' },
        system,
        messages: [{ role: 'user', content: question }],
      });
      if (response.stop_reason === 'refusal') return REFUSAL_ANSWER;

      return response.content
        .flatMap((block) => (block.type === 'text' ? [block.text] : []))
        .join('\n');
    },
  };
}

function openAIModel(model: string): ChatModel {
  const client = wrapOpenAI(new OpenAI());

  return {
    provider: 'openai',
    model,
    async answer(system, question) {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: question },
        ],
      });

      return response.choices[0]?.message.content ?? '';
    },
  };
}

export function createChatModel(env: NodeJS.ProcessEnv): ChatModel | undefined {
  const model = env.MODEL || undefined;
  if (env.ANTHROPIC_API_KEY) return anthropicModel(model ?? DEFAULT_ANTHROPIC_MODEL);
  if (env.OPENAI_API_KEY) return openAIModel(model ?? DEFAULT_OPENAI_MODEL);

  return undefined;
}

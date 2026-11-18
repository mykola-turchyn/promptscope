import { randomUUID } from 'node:crypto';
import { Promptscope } from '@promptscope/sdk';
import { type Article, searchArticles } from './knowledge-base.ts';
import { createChatModel } from './llm.ts';
import { type CustomerQuestion, QUESTIONS } from './questions.ts';

const SYSTEM_PROMPT = `Ти агент підтримки сервісу Acme Cloud. Відповідай українською, коротко (до 4 речень).
Спирайся лише на статті з бази знань нижче. Якщо в статтях немає відповіді, чесно скажи, що передаєш питання оператору.`;

function systemPromptWith(articles: Article[]): string {
  const context = articles.map(({ title, body }) => `## ${title}\n${body}`).join('\n\n');

  return `${SYSTEM_PROMPT}\n\n# База знань\n${context || '(нічого не знайдено)'}`;
}

function exitWith(message: string): never {
  console.error(`${message} in examples/support-bot/.env (see .env.example)`);
  process.exit(1);
}

if (!process.env.PROMPTSCOPE_API_KEY) exitWith('Set PROMPTSCOPE_API_KEY');
const chat = createChatModel(process.env) ?? exitWith('Set ANTHROPIC_API_KEY or OPENAI_API_KEY');
const ps = new Promptscope({ environment: 'development', debug: true });
const sessionId = `run_${randomUUID().slice(0, 8)}`;

async function handle({ userId, topic, text }: CustomerQuestion): Promise<string> {
  return ps.trace(
    'support.answer',
    async () => {
      const articles = await ps.span('kb.search', () => searchArticles(text), {
        type: 'retrieval',
        input: { query: text },
      });
      ps.score({ name: 'retrieval_hit', value: articles.length > 0 ? 1 : 0 });
      const system = systemPromptWith(articles);

      return chat.answer(system, text);
    },
    {
      userId,
      sessionId,
      tags: [topic, chat.provider],
      input: { question: text },
      metadata: { model: chat.model },
    },
  );
}

console.log(`Model: ${chat.provider} / ${chat.model}, session ${sessionId}\n`);
for (const question of QUESTIONS) {
  const answer = await handle(question);
  console.log(`❓ ${question.text}\n💬 ${answer}\n`);
}
await ps.shutdown();
console.log(`Sent ${QUESTIONS.length} traces. Open Traces in your Promptscope project.`);

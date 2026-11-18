# @promptscope/sdk

Trace LLM calls from Node and fetch versioned prompts from Promptscope. No runtime dependencies,
ESM and CommonJS, Node 20+.

```bash
pnpm add @promptscope/sdk
```

## Tracing

```ts
import { Promptscope } from '@promptscope/sdk';

const ps = new Promptscope({
  apiKey: process.env.PROMPTSCOPE_API_KEY,
  baseUrl: process.env.PROMPTSCOPE_BASE_URL, // defaults to http://localhost:4318
});

const answer = await ps.trace(
  'support.answer',
  async (trace) => {
    const docs = await ps.span('kb.retrieve', () => search(question), { type: 'retrieval' });
    trace.update({ tags: ['billing'] });

    return ps.span('llm.answer', () => callModel(docs), { type: 'llm', model: 'gpt-4.1-mini' });
  },
  { userId: 'u_4821', input: { question } },
);
```

Nested spans find their parent through `AsyncLocalStorage`, so you never pass spans around.
A span started outside a trace creates one.

## Wrapping OpenAI and Anthropic

```ts
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { wrapAnthropic, wrapOpenAI } from '@promptscope/sdk';

const openai = wrapOpenAI(new OpenAI());
const anthropic = wrapAnthropic(new Anthropic());
```

Wrapped clients keep their original types. `chat.completions.create`, `responses.create` and
`messages.create` become LLM spans with model, input, output and token usage. Streams work too:
tokens are counted when the stream finishes (the OpenAI wrapper turns on `include_usage`).

## Prompts

```ts
const prompt = await ps.getPrompt('support-reply'); // label "production" by default
const staging = await ps.getPrompt('support-reply', { label: 'staging' });
const pinned = await ps.getPrompt('support-reply', { version: 12 });

await ps.trace('support.answer', () => run(prompt.compile({ message })), { prompt });
```

Prompts are cached for a minute. If the server cannot be reached, the last fetched version is used,
then `fallback` if you pass one. Passing `prompt` to `trace` links the trace to that version, so the
dashboard shows metrics per prompt version.

## Scores

```ts
ps.score({ name: 'resolved', value: 1 }); // inside a trace, or pass traceId
```

## Behaviour you can rely on

- **Never breaks your app.** Telemetry errors are swallowed; set `debug: true` to log them.
- **Batched in the background.** Up to 100 events or 2 seconds, retries with exponential backoff
  on network errors, 429 and 5xx. Call `await ps.flush()` before a serverless function returns.
- **PII redaction.** `mask: (data) => redact(data)` runs on every input, output and metadata value
  before it leaves the process.
- **No key, no traffic.** Without an API key the client is a no-op.

| Option                              | Default                                           |
| ----------------------------------- | ------------------------------------------------- |
| `apiKey`                            | `PROMPTSCOPE_API_KEY`                             |
| `baseUrl`                           | `PROMPTSCOPE_BASE_URL` or `http://localhost:4318` |
| `environment`                       | `production`                                      |
| `flushAt` / `flushIntervalMs`       | `100` / `2000`                                    |
| `maxRetries`                        | `3`                                               |
| `mask`, `debug`, `enabled`, `fetch` | –                                                 |

import { HttpResponse, http } from 'msw';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Promptscope } from '../src/index.ts';
import { BASE_URL, eventsOfType, received, server } from './server.ts';

const options = { apiKey: 'ps_live_test', baseUrl: BASE_URL, maxRetries: 0 };

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  received.length = 0;
});
afterAll(() => server.close());

describe('Promptscope.trace and span', () => {
  it('links nested spans to their parent without passing arguments', async () => {
    const ps = new Promptscope(options);
    const inner = async () => ps.span('tool.lookup', () => 'found', { type: 'tool' });

    const result = await ps.trace('support.answer', async () =>
      ps.span('agent.step', async () => inner(), { type: 'agent' }),
    );
    await ps.flush();

    const [trace] = eventsOfType('trace');
    const spans = eventsOfType('span');
    const step = spans.find((span) => span.name === 'agent.step');
    const lookup = spans.find((span) => span.name === 'tool.lookup');
    expect(result).toBe('found');
    expect(trace).toMatchObject({ name: 'support.answer', status: 'ok', output: 'found' });
    expect(step?.traceId).toBe(trace?.id);
    expect(lookup?.parentId).toBe(step?.id);
    expect(step?.parentId).toBeUndefined();
  });

  it('records errors and rethrows them', async () => {
    const ps = new Promptscope(options);

    await expect(
      ps.trace('job', () =>
        ps.span('tool.refund', () => {
          throw new Error('timeout');
        }),
      ),
    ).rejects.toThrow('timeout');
    await ps.flush();

    expect(eventsOfType('span')[0]).toMatchObject({ status: 'error', error: 'Error: timeout' });
    expect(eventsOfType('trace')[0]).toMatchObject({ status: 'error' });
  });

  it('creates a trace for a span started outside of one', async () => {
    const ps = new Promptscope(options);

    await ps.span('cron.cleanup', () => 1);
    await ps.flush();

    expect(eventsOfType('trace')).toHaveLength(1);
    expect(eventsOfType('span')[0]?.traceId).toBe(eventsOfType('trace')[0]?.id);
  });

  it('masks data before it leaves the process', async () => {
    const ps = new Promptscope({ ...options, mask: () => '[redacted]' });

    await ps.trace('job', () => 'secret answer', { input: { email: 'a@b.c' } });
    await ps.flush();

    expect(eventsOfType('trace')[0]).toMatchObject({ input: '[redacted]', output: '[redacted]' });
  });
});

describe('batching and failure handling', () => {
  it('sends a batch as soon as flushAt events are buffered', async () => {
    const ps = new Promptscope({ ...options, flushAt: 2, flushIntervalMs: 60_000 });

    await ps.trace('a', () => ps.span('b', () => 1));
    await ps.flush();

    expect(received).toHaveLength(2);
  });

  it('never throws into the app when the ingest API is down', async () => {
    server.use(http.post(`${BASE_URL}/v1/ingest`, () => HttpResponse.error()));
    const ps = new Promptscope({ ...options, maxRetries: 1 });

    await expect(ps.trace('job', () => 'ok')).resolves.toBe('ok');
    await expect(ps.flush()).resolves.toBeUndefined();
  });

  it('retries server errors with backoff', async () => {
    let attempts = 0;
    server.use(
      http.post(`${BASE_URL}/v1/ingest`, () => {
        attempts += 1;

        return attempts < 2
          ? new HttpResponse(null, { status: 503 })
          : HttpResponse.json({}, { status: 202 });
      }),
    );
    const ps = new Promptscope({ ...options, maxRetries: 2 });

    await ps.trace('job', () => 1);
    await ps.flush();

    expect(attempts).toBe(2);
  });

  it('is a no-op without an API key', async () => {
    const ps = new Promptscope({ baseUrl: BASE_URL, apiKey: '' });

    await ps.trace('job', () => 1);
    await ps.flush();

    expect(received).toHaveLength(0);
  });
});

describe('getPrompt', () => {
  const prompt = {
    id: 'pv_1',
    name: 'support-reply',
    version: 12,
    template: 'Hello {{customer_name}}',
    variables: ['customer_name'],
    labels: ['production'],
    modelConfig: {},
  };

  it('fetches by label, caches and compiles', async () => {
    let requests = 0;
    server.use(
      http.get(`${BASE_URL}/v1/prompts/support-reply`, ({ request }) => {
        requests += 1;
        expect(new URL(request.url).searchParams.get('label')).toBe('production');

        return HttpResponse.json(prompt);
      }),
    );
    const ps = new Promptscope(options);

    const first = await ps.getPrompt('support-reply');
    await ps.getPrompt('support-reply');

    expect(requests).toBe(1);
    expect(first.compile({ customer_name: 'Ada' })).toBe('Hello Ada');
  });

  it('falls back to the last known version when the server is unreachable', async () => {
    server.use(http.get(`${BASE_URL}/v1/prompts/support-reply`, () => HttpResponse.json(prompt)));
    const ps = new Promptscope(options);
    await ps.getPrompt('support-reply', { cacheTtlMs: 0 });
    server.use(http.get(`${BASE_URL}/v1/prompts/support-reply`, () => HttpResponse.error()));

    const cached = await ps.getPrompt('support-reply', { cacheTtlMs: 0 });

    expect(cached.version).toBe(12);
  });

  it('uses the provided fallback when nothing was fetched before', async () => {
    server.use(http.get(`${BASE_URL}/v1/prompts/support-reply`, () => HttpResponse.error()));
    const ps = new Promptscope(options);

    const result = await ps.getPrompt('support-reply', { fallback: { ...prompt, version: 1 } });

    expect(result.version).toBe(1);
  });
});

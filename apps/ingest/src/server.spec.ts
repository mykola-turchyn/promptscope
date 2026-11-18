import type { IngestJob } from '@promptscope/shared';
import { afterEach, describe, expect, it } from 'vitest';
import type { IngestDependencies } from './ports.ts';
import { buildServer, MAX_BODY_BYTES } from './server.ts';

const VALID_KEY = 'ps_live_valid';
const PROJECT_ID = 'project-1';

function setup(overrides: Partial<IngestDependencies> = {}) {
  const jobs: IngestJob[] = [];
  const app = buildServer(
    {
      projects: { resolve: async (key) => (key === VALID_KEY ? PROJECT_ID : null) },
      prompts: {
        find: async (projectId, name, selector) =>
          projectId === PROJECT_ID && name === 'support-reply' && 'label' in selector
            ? {
                id: 'pv',
                name,
                version: 12,
                template: 'Hi',
                variables: [],
                labels: [selector.label],
                modelConfig: {},
              }
            : null,
      },
      queue: { enqueue: async (job) => void jobs.push(job) },
      rateLimiter: { take: async () => ({ allowed: true, retryAfterSeconds: 0 }) },
      ...overrides,
    },
    { logLevel: 'silent' },
  );

  return { app, jobs };
}

const span = {
  type: 'span',
  id: 'sp_1',
  traceId: 'tr_1',
  name: 'llm.answer',
  startedAt: '2026-11-17T10:00:00.000Z',
  endedAt: '2026-11-17T10:00:01.000Z',
};

const authorized = { authorization: `Bearer ${VALID_KEY}` };

let current: ReturnType<typeof setup> | undefined;
afterEach(async () => current?.app.close());

describe('POST /v1/ingest', () => {
  it('accepts a valid batch with 202 and enqueues it for the key’s project', async () => {
    current = setup();
    const response = await current.app.inject({
      method: 'POST',
      url: '/v1/ingest',
      headers: authorized,
      payload: { events: [span] },
    });

    expect(response.statusCode).toBe(202);
    expect(current.jobs).toHaveLength(1);
    expect(current.jobs[0]).toMatchObject({ projectId: PROJECT_ID, events: [{ id: 'sp_1' }] });
  });

  it('rejects missing and unknown keys with 401', async () => {
    current = setup();
    const missing = await current.app.inject({ method: 'POST', url: '/v1/ingest', payload: {} });
    const unknown = await current.app.inject({
      method: 'POST',
      url: '/v1/ingest',
      headers: { authorization: 'Bearer ps_live_other' },
      payload: { events: [span] },
    });

    expect(missing.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(current.jobs).toHaveLength(0);
  });

  it('rejects invalid events with 400', async () => {
    current = setup();
    const response = await current.app.inject({
      method: 'POST',
      url: '/v1/ingest',
      headers: authorized,
      payload: { events: [{ ...span, startedAt: 'yesterday' }] },
    });

    expect(response.statusCode).toBe(400);
  });

  it('answers 429 with Retry-After when the project is over its rate', async () => {
    current = setup({
      rateLimiter: { take: async () => ({ allowed: false, retryAfterSeconds: 3 }) },
    });
    const response = await current.app.inject({
      method: 'POST',
      url: '/v1/ingest',
      headers: authorized,
      payload: { events: [span] },
    });

    expect(response.statusCode).toBe(429);
    expect(response.headers['retry-after']).toBe('3');
  });

  it('limits the request body size', async () => {
    current = setup();
    const response = await current.app.inject({
      method: 'POST',
      url: '/v1/ingest',
      headers: { ...authorized, 'content-type': 'application/json' },
      payload: JSON.stringify({ events: [{ ...span, input: 'x'.repeat(MAX_BODY_BYTES) }] }),
    });

    expect(response.statusCode).toBe(413);
  });
});

describe('GET /v1/prompts/:name', () => {
  it('returns the production version by default', async () => {
    current = setup();
    const response = await current.app.inject({
      url: '/v1/prompts/support-reply',
      headers: authorized,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ version: 12, labels: ['production'] });
  });

  it('returns 404 for prompts of other projects', async () => {
    current = setup();
    const response = await current.app.inject({ url: '/v1/prompts/other', headers: authorized });

    expect(response.statusCode).toBe(404);
  });
});

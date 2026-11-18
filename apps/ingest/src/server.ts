import { ingestBatchSchema, PROMPT_LABELS, parseBearerToken } from '@promptscope/shared';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { IngestDependencies } from './ports.ts';

export const MAX_BODY_BYTES = 1_048_576;
const HTTP_ACCEPTED = 202;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_TOO_MANY_REQUESTS = 429;

declare module 'fastify' {
  interface FastifyRequest {
    projectId: string;
  }
}

const promptQuerySchema = z.union([
  z.object({ version: z.coerce.number().int().positive() }),
  z.object({ label: z.enum(PROMPT_LABELS).default('production') }),
]);

export interface ServerOptions {
  logLevel?: string;
}

export function buildServer(dependencies: IngestDependencies, options: ServerOptions = {}) {
  const app = Fastify({
    bodyLimit: MAX_BODY_BYTES,
    logger: { level: options.logLevel ?? 'info' },
  });
  app.decorateRequest('projectId', '');

  async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    const apiKey = parseBearerToken(request.headers.authorization);
    const projectId = apiKey ? await dependencies.projects.resolve(apiKey) : null;
    if (!projectId) {
      return reply.code(HTTP_UNAUTHORIZED).send({ error: 'Invalid or revoked API key' });
    }
    request.projectId = projectId;
  }

  app.get('/health', async () => ({ status: 'ok' }));

  app.post('/v1/ingest', { preHandler: authenticate }, async (request, reply) => {
    const parsed = ingestBatchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(HTTP_BAD_REQUEST)
        .send({ error: 'Invalid batch', issues: z.treeifyError(parsed.error) });
    }
    const { events } = parsed.data;
    const limit = await dependencies.rateLimiter.take(request.projectId, events.length);
    if (!limit.allowed) {
      return reply
        .code(HTTP_TOO_MANY_REQUESTS)
        .header('retry-after', String(limit.retryAfterSeconds))
        .send({ error: 'Rate limit exceeded' });
    }
    await dependencies.queue.enqueue({
      projectId: request.projectId,
      receivedAt: new Date().toISOString(),
      events,
    });

    return reply.code(HTTP_ACCEPTED).send({ accepted: events.length });
  });

  app.get<{ Params: { name: string }; Querystring: Record<string, string> }>(
    '/v1/prompts/:name',
    { preHandler: authenticate },
    async (request, reply) => {
      const selector = promptQuerySchema.safeParse(request.query);
      if (!selector.success) {
        return reply.code(HTTP_BAD_REQUEST).send({ error: 'Pass a label or a version' });
      }
      const prompt = await dependencies.prompts.find(
        request.projectId,
        request.params.name,
        selector.data,
      );
      if (!prompt) return reply.code(HTTP_NOT_FOUND).send({ error: 'Prompt not found' });

      return prompt;
    },
  );

  return app;
}

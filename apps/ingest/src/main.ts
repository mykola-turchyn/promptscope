import { createDb } from '@promptscope/db';
import { INGEST_QUEUE, type IngestJob } from '@promptscope/shared';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import {
  createEventQueue,
  createProjectResolver,
  createPromptStore,
  createRateLimiter,
} from './adapters.ts';
import { loadEnv } from './env.ts';
import { buildServer } from './server.ts';

const env = loadEnv();
const { db, close } = createDb(env.DATABASE_URL);
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const queue = new Queue<IngestJob>(INGEST_QUEUE, { connection: redis });
const logRedisError = (error: Error) => console.error(`[redis] ${error.message}`);
redis.on('error', logRedisError);
queue.on('error', logRedisError);

const app = buildServer(
  {
    projects: createProjectResolver(db, redis),
    prompts: createPromptStore(db),
    queue: createEventQueue(queue),
    rateLimiter: createRateLimiter(redis, env.INGEST_RATE_LIMIT_PER_SECOND),
  },
  { logLevel: env.LOG_LEVEL },
);

async function shutdown() {
  await app.close();
  await queue.close();
  redis.disconnect();
  await close();
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

await app.listen({ port: env.port, host: '0.0.0.0' });

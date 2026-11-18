import { EVAL_QUEUE, type EvalJob } from '@promptscope/shared';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from './env';

// Redis outages must not crash the dashboard: connections retry on their own, so errors are
// only logged. Live updates and eval queueing come back when Redis does.
function logRedisError(error: Error) {
  console.error(`[redis] ${error.message}`);
}

export const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });
redis.on('error', logRedisError);

export const evalQueue = new Queue<EvalJob>(EVAL_QUEUE, { connection: redis });
evalQueue.on('error', logRedisError);

export function createSubscriber(): Redis {
  const subscriber = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  subscriber.on('error', logRedisError);

  return subscriber;
}

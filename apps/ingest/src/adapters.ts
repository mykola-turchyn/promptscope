import { type Db, schema } from '@promptscope/db';
import {
  apiKeyCacheKey,
  hashApiKey,
  INGEST_QUEUE,
  type IngestJob,
  isWellFormedApiKey,
} from '@promptscope/shared';
import type { Queue } from 'bullmq';
import { and, arrayContains, desc, eq, isNull } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import type { EventQueue, ProjectResolver, PromptStore, RateLimiter } from './ports.ts';

const API_KEY_CACHE_SECONDS = 60;
const REVOKED_MARKER = '-';
const JOB_ATTEMPTS = 5;
const JOB_BACKOFF_MS = 1_000;
const BURST_SECONDS = 2;

export function createProjectResolver(db: Db, redis: Redis): ProjectResolver {
  return {
    async resolve(apiKey) {
      if (!isWellFormedApiKey(apiKey)) return null;
      const hash = hashApiKey(apiKey);
      const cacheKey = apiKeyCacheKey(hash);
      const cached = await redis.get(cacheKey);
      if (cached) return cached === REVOKED_MARKER ? null : cached;

      const [key] = await db
        .update(schema.apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(and(eq(schema.apiKeys.keyHash, hash), isNull(schema.apiKeys.revokedAt)))
        .returning({ projectId: schema.apiKeys.projectId });
      await redis.set(cacheKey, key?.projectId ?? REVOKED_MARKER, 'EX', API_KEY_CACHE_SECONDS);

      return key?.projectId ?? null;
    },
  };
}

export function createPromptStore(db: Db): PromptStore {
  return {
    async find(projectId, name, selector) {
      const versionFilter =
        'version' in selector
          ? eq(schema.promptVersions.version, selector.version)
          : arrayContains(schema.promptVersions.labels, [selector.label]);
      const [row] = await db
        .select({ prompt: schema.prompts, version: schema.promptVersions })
        .from(schema.promptVersions)
        .innerJoin(schema.prompts, eq(schema.prompts.id, schema.promptVersions.promptId))
        .where(
          and(
            eq(schema.prompts.projectId, projectId),
            eq(schema.prompts.name, name),
            versionFilter,
          ),
        )
        .orderBy(desc(schema.promptVersions.version))
        .limit(1);
      if (!row) return null;

      return {
        id: row.version.id,
        name: row.prompt.name,
        version: row.version.version,
        template: row.version.template,
        variables: row.version.variables,
        labels: row.version.labels,
        modelConfig: { ...row.version.modelConfig },
      };
    },
  };
}

export function createEventQueue(queue: Queue<IngestJob>): EventQueue {
  return {
    async enqueue(job) {
      await queue.add(INGEST_QUEUE, job, {
        attempts: JOB_ATTEMPTS,
        backoff: { type: 'exponential', delay: JOB_BACKOFF_MS },
        removeOnComplete: true,
        removeOnFail: false,
      });
    },
  };
}

// Token bucket per project; refills `ratePerSecond` tokens a second up to a two-second burst.
const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local rate = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])
local bucket = redis.call('HMGET', key, 'tokens', 'updated')
local tokens = tonumber(bucket[1]) or capacity
local updated = tonumber(bucket[2]) or now
tokens = math.min(capacity, tokens + (now - updated) / 1000 * rate)
local allowed = 0
if tokens >= requested then
  tokens = tokens - requested
  allowed = 1
end
redis.call('HSET', key, 'tokens', tokens, 'updated', now)
redis.call('PEXPIRE', key, math.ceil(capacity / rate * 1000) + 1000)
return { allowed, tostring(tokens) }
`;

export function createRateLimiter(redis: Redis, ratePerSecond: number): RateLimiter {
  const capacity = ratePerSecond * BURST_SECONDS;

  return {
    async take(projectId, tokens) {
      const [allowed, remaining] = (await redis.eval(
        TOKEN_BUCKET_SCRIPT,
        1,
        `ps:ratelimit:${projectId}`,
        ratePerSecond,
        capacity,
        Date.now(),
        Math.min(tokens, capacity),
      )) as [number, string];
      const missing = Math.max(0, Math.min(tokens, capacity) - Number(remaining));

      return {
        allowed: allowed === 1,
        retryAfterSeconds: Math.max(1, Math.ceil(missing / ratePerSecond)),
      };
    },
  };
}

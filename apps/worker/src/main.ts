import { createDb } from '@promptscope/db';
import {
  EVAL_QUEUE,
  type EvalJob,
  INGEST_DEAD_LETTER_QUEUE,
  INGEST_QUEUE,
  type IngestJob,
  projectChannel,
} from '@promptscope/shared';
import { type Job, Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { loadEnv } from './env.ts';
import { createLlmClient } from './evals/llm.ts';
import { runEval } from './evals/run-eval.ts';
import { writeBatch } from './ingest/write-batch.ts';
import { createPriceCache } from './prices.ts';
import { applyRetention } from './retention.ts';

const RETENTION_QUEUE = 'retention';
const RETENTION_SCHEDULE = '0 3 * * *';

const env = loadEnv();
const { db, close } = createDb(env.DATABASE_URL);
const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const publisher = new Redis(env.REDIS_URL);
const logError = (source: string) => (error: Error) =>
  console.error(`[${source}] ${error.message}`);
connection.on('error', logError('redis'));
publisher.on('error', logError('redis'));
const priceCache = createPriceCache(db);
const llm = createLlmClient({ openai: env.OPENAI_API_KEY, anthropic: env.ANTHROPIC_API_KEY });
const deadLetter = new Queue<IngestJob & { error: string }>(INGEST_DEAD_LETTER_QUEUE, {
  connection,
});
const retentionQueue = new Queue(RETENTION_QUEUE, { connection });

function publish(projectId: string, payload: Record<string, unknown>) {
  publisher.publish(projectChannel(projectId), JSON.stringify(payload)).catch(() => undefined);
}

const ingestWorker = new Worker<IngestJob>(
  INGEST_QUEUE,
  async (job) => {
    const prices = await priceCache.get();
    const { traceIds, spanCount } = await writeBatch(db, prices, job.data);
    publish(job.data.projectId, { type: 'traces', traceCount: traceIds.length, spanCount });
  },
  { connection, concurrency: env.WORKER_INGEST_CONCURRENCY },
);

ingestWorker.on('error', logError('ingest worker'));
ingestWorker.on('failed', (job: Job<IngestJob> | undefined, error) => {
  if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
  deadLetter.add('dead', { ...job.data, error: error.message }).catch(() => undefined);
});

const evalWorker = new Worker<EvalJob>(
  EVAL_QUEUE,
  async (job) => {
    await runEval(
      {
        db,
        llm,
        prices: await priceCache.get(),
        onProgress: ({ projectId, ...progress }) =>
          publish(projectId, { type: 'eval', ...progress }),
      },
      job.data.runId,
    );
  },
  { connection, concurrency: env.WORKER_EVAL_CONCURRENCY },
);

evalWorker.on('error', logError('eval worker'));

const retentionWorker = new Worker(RETENTION_QUEUE, () => applyRetention(db), { connection });
retentionWorker.on('error', logError('retention worker'));
deadLetter.on('error', logError('dead letter queue'));
retentionQueue.on('error', logError('retention queue'));
await retentionQueue.upsertJobScheduler('nightly', { pattern: RETENTION_SCHEDULE });

console.log('Worker started: ingest, eval runs, retention');

async function shutdown() {
  await Promise.all([ingestWorker.close(), evalWorker.close(), retentionWorker.close()]);
  await Promise.all([deadLetter.close(), retentionQueue.close()]);
  publisher.disconnect();
  connection.disconnect();
  await close();
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

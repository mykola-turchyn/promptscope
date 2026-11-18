import { z } from 'zod';

const DEFAULT_INGEST_CONCURRENCY = 4;
const DEFAULT_EVAL_CONCURRENCY = 2;

const envSchema = z.object({
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  WORKER_INGEST_CONCURRENCY: z.coerce.number().int().positive().default(DEFAULT_INGEST_CONCURRENCY),
  WORKER_EVAL_CONCURRENCY: z.coerce.number().int().positive().default(DEFAULT_EVAL_CONCURRENCY),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}

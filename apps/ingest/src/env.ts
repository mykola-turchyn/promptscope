import { z } from 'zod';

const DEFAULT_PORT = 4318;
const DEFAULT_RATE_LIMIT_PER_SECOND = 200;

const envSchema = z.object({
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  INGEST_PORT: z.coerce.number().int().positive().optional(),
  PORT: z.coerce.number().int().positive().optional(),
  INGEST_RATE_LIMIT_PER_SECOND: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_RATE_LIMIT_PER_SECOND),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export function loadEnv(source: NodeJS.ProcessEnv = process.env) {
  const env = envSchema.parse(source);

  // Hosts such as Railway assign the port through PORT.
  return { ...env, port: env.INGEST_PORT ?? env.PORT ?? DEFAULT_PORT };
}

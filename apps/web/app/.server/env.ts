import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  GITHUB_CLIENT_ID: z
    .string()
    .optional()
    .transform((value) => value || undefined),
  GITHUB_CLIENT_SECRET: z
    .string()
    .optional()
    .transform((value) => value || undefined),
  DEMO_USER_PASSWORD: z.string().min(12),
  PUBLIC_INGEST_URL: z.url().default('http://localhost:4318'),
  PUBLIC_DOCS_URL: z.url().default('https://www.npmjs.com/package/@promptscope/sdk'),
});

export const env = envSchema.parse(process.env);

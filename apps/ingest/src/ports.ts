import type { IngestJob, PromptLabel, PromptResponse } from '@promptscope/shared';

export interface ProjectResolver {
  resolve(apiKey: string): Promise<string | null>;
}

export interface PromptStore {
  find(
    projectId: string,
    name: string,
    selector: { label: PromptLabel } | { version: number },
  ): Promise<PromptResponse | null>;
}

export interface EventQueue {
  enqueue(job: IngestJob): Promise<void>;
}

export interface RateLimiter {
  take(projectId: string, tokens: number): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
}

export interface IngestDependencies {
  projects: ProjectResolver;
  prompts: PromptStore;
  queue: EventQueue;
  rateLimiter: RateLimiter;
}

import type { IngestEventInput } from '@promptscope/shared/events';
import type { Logger } from './logger.ts';

const MAX_QUEUE_SIZE = 10_000;
const BASE_RETRY_DELAY_MS = 250;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_CLIENT_ERROR_MIN = 400;
const HTTP_SERVER_ERROR_MIN = 500;

export interface TransportOptions {
  apiKey: string;
  baseUrl: string;
  flushAt: number;
  flushIntervalMs: number;
  maxRetries: number;
  fetch: typeof fetch;
  logger: Logger;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryable(status: number): boolean {
  return status === HTTP_TOO_MANY_REQUESTS || status >= HTTP_SERVER_ERROR_MIN;
}

export class Transport {
  private queue: IngestEventInput[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly inFlight = new Set<Promise<void>>();

  constructor(private readonly options: TransportOptions) {}

  enqueue(event: IngestEventInput): void {
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      this.queue.shift();
      this.options.logger.debug('Queue is full, dropped the oldest event');
    }
    this.queue.push(event);
    if (this.queue.length >= this.options.flushAt) {
      void this.flush();
    } else {
      this.schedule();
    }
  }

  async flush(): Promise<void> {
    this.clearTimer();
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.options.flushAt);
      const sending = this.send(batch).finally(() => this.inFlight.delete(sending));
      this.inFlight.add(sending);
    }
    await Promise.all(this.inFlight);
  }

  private schedule(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, this.options.flushIntervalMs);
    this.timer.unref?.();
  }

  private clearTimer(): void {
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  private async send(events: IngestEventInput[]): Promise<void> {
    const { baseUrl, apiKey, maxRetries, logger } = this.options;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const response = await this.options.fetch(`${baseUrl}/v1/ingest`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ events }),
        });
        if (response.ok) return;
        const retryable = isRetryable(response.status);
        if (!retryable && response.status >= HTTP_CLIENT_ERROR_MIN) {
          logger.debug(`Ingest rejected the batch with ${response.status}, dropping it`);

          return;
        }
      } catch (error) {
        logger.debug('Ingest request failed', error);
      }
      if (attempt < maxRetries) await sleep(BASE_RETRY_DELAY_MS * 2 ** attempt);
    }
    logger.debug(`Dropped ${events.length} events after ${maxRetries + 1} attempts`);
  }
}

import { AsyncLocalStorage } from 'node:async_hooks';

export interface ActiveContext {
  traceId: string;
  spanId: string | null;
}

export const contextStorage = new AsyncLocalStorage<ActiveContext>();

export function currentContext(): ActiveContext | undefined {
  return contextStorage.getStore();
}

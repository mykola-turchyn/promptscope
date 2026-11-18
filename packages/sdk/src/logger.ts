export interface Logger {
  debug(message: string, detail?: unknown): void;
}

export function createLogger(enabled: boolean): Logger {
  return {
    debug(message, detail) {
      if (!enabled) return;
      console.debug(`[promptscope] ${message}`, detail ?? '');
    },
  };
}

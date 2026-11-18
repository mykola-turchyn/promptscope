import { useEffect, useState } from 'react';
import { useRevalidator } from 'react-router';

const MIN_REVALIDATE_INTERVAL_MS = 5_000;

export function useLiveUpdates(eventsUrl: string, enabled: boolean): boolean {
  const { revalidate } = useRevalidator();
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    const source = new EventSource(eventsUrl);
    let lastRevalidate = 0;
    let pending: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      const wait = lastRevalidate + MIN_REVALIDATE_INTERVAL_MS - Date.now();
      if (wait > 0) {
        pending ??= setTimeout(() => {
          pending = undefined;
          refresh();
        }, wait);

        return;
      }
      lastRevalidate = Date.now();
      void revalidate();
    };
    source.addEventListener('open', () => setConnected(true));
    source.addEventListener('error', () => setConnected(false));
    source.addEventListener('update', refresh);

    return () => {
      clearTimeout(pending);
      source.close();
    };
  }, [eventsUrl, enabled, revalidate]);

  return connected;
}

import { useEffect } from 'react';
import { useRevalidator, useRouteLoaderData } from 'react-router';

export const TIME_ZONE_COOKIE = 'ps-tz';
export const DEFAULT_TIME_ZONE = 'UTC';
const ONE_YEAR_SECONDS = 31_536_000;

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });

    return true;
  } catch {
    return false;
  }
}

export function readTimeZoneCookie(cookieHeader: string | null): string {
  const match = cookieHeader?.match(new RegExp(`(?:^|;\\s*)${TIME_ZONE_COOKIE}=([^;]+)`));
  const value = match?.[1] ? decodeURIComponent(match[1]) : '';

  return value && isValidTimeZone(value) ? value : DEFAULT_TIME_ZONE;
}

export function requestTimeZone(request: Request): string {
  return readTimeZoneCookie(request.headers.get('cookie'));
}

export function useTimeZone(): string {
  const data = useRouteLoaderData<{ timeZone?: string }>('root');

  return data?.timeZone ?? DEFAULT_TIME_ZONE;
}

// Server rendering only knows the time zone from the cookie, so the first visit renders in UTC
// and switches to the browser's zone right after hydration.
export function useSyncTimeZone(current: string) {
  const { revalidate } = useRevalidator();

  useEffect(() => {
    const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!browserZone || browserZone === current) return;
    const value = encodeURIComponent(browserZone);
    // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is missing in some browsers we support
    document.cookie = `${TIME_ZONE_COOKIE}=${value}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
    void revalidate();
  }, [current, revalidate]);
}

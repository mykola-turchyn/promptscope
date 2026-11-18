export const THEME_COOKIE = 'ps-theme';
export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

export function readThemeCookie(cookieHeader: string | null): Theme | null {
  const match = cookieHeader?.match(new RegExp(`(?:^|;\\s*)${THEME_COOKIE}=(light|dark)`));
  const value = match?.[1];

  return isTheme(value) ? value : null;
}

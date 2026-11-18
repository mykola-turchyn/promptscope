const MS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;
const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const CENT = 0.01;
const RECENT_MS = 10_000;
const MAX_FRACTION_DIGITS = 8;

const integerFormat = new Intl.NumberFormat('en-US');
const moneyFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCount(value: number): string {
  return integerFormat.format(Math.round(value));
}

export function formatCost(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (value === 0) return '$0';
  if (value >= 1) return `$${moneyFormat.format(value)}`;
  if (value >= CENT) return `$${value.toFixed(3)}`;
  const digits = Math.min(MAX_FRACTION_DIGITS, Math.ceil(-Math.log10(value)));

  return `$${value.toFixed(digits)}`;
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—';
  const seconds = ms / MS_PER_SECOND;
  if (seconds < SECONDS_PER_MINUTE) return `${seconds.toFixed(1)} s`;
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  const rest = Math.round(seconds - minutes * SECONDS_PER_MINUTE);

  return `${minutes} min ${rest} s`;
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

export function formatSignedPercent(value: number): string {
  const sign = value >= 0 ? '+' : '−';

  return `${sign}${Math.abs(value).toFixed(1)}%`;
}

export function formatTokens(input: number | null, output: number | null): string {
  if (input === null && output === null) return '—';

  return `${formatCount(input ?? 0)} / ${formatCount(output ?? 0)}`;
}

function parts(date: Date, timeZone: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', ...options }).format(date);
}

export function formatDay(date: Date, timeZone: string): string {
  return parts(date, timeZone, { month: 'short', day: 'numeric' });
}

export function formatDate(date: Date, timeZone: string): string {
  return parts(date, timeZone, { month: 'short', day: '2-digit', year: 'numeric' });
}

export function formatDayTime(date: Date, timeZone: string): string {
  const time = parts(date, timeZone, { hour: '2-digit', minute: '2-digit' });

  return `${formatDay(date, timeZone)}, ${time}`;
}

export function formatClock(date: Date, timeZone: string): string {
  return parts(date, timeZone, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatDateTimeSeconds(date: Date, timeZone: string): string {
  const year = parts(date, timeZone, { year: 'numeric' });

  return `${formatDay(date, timeZone)}, ${year}, ${formatClock(date, timeZone)}`;
}

export function formatStarted(date: Date, now: Date, timeZone: string): string {
  const sameDay = formatDate(date, timeZone) === formatDate(now, timeZone);

  return sameDay ? formatClock(date, timeZone) : formatDayTime(date, timeZone);
}

export function formatDayRange(from: Date, to: Date, timeZone: string): string {
  const year = parts(to, timeZone, { year: 'numeric' });

  return `${formatDay(from, timeZone)} – ${formatDay(to, timeZone)}, ${year}`;
}

export function formatRelative(date: Date | null, now: Date): string {
  if (!date) return 'Never';
  const elapsed = now.getTime() - date.getTime();
  if (elapsed < RECENT_MS) return 'Just now';
  if (elapsed < MINUTE_MS) return `${Math.floor(elapsed / MS_PER_SECOND)} s ago`;
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)} min ago`;
  if (elapsed < DAY_MS) return `${Math.floor(elapsed / HOUR_MS)} h ago`;
  const days = Math.floor(elapsed / DAY_MS);

  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

import { createHash } from 'node:crypto';
import { randomString } from './ids.ts';

const API_KEY_PREFIX = 'ps_live_';
const API_KEY_RANDOM_LENGTH = 32;
const VISIBLE_SECRET_CHARS = 4;
const KEY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export interface GeneratedApiKey {
  key: string;
  hash: string;
  prefix: string;
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function apiKeyDisplayPrefix(key: string): string {
  return `${key.slice(0, API_KEY_PREFIX.length + VISIBLE_SECRET_CHARS)}…`;
}

export function generateApiKey(): GeneratedApiKey {
  const key = `${API_KEY_PREFIX}${randomString(API_KEY_RANDOM_LENGTH, KEY_ALPHABET)}`;

  return { key, hash: hashApiKey(key), prefix: apiKeyDisplayPrefix(key) };
}

export function isWellFormedApiKey(value: string): boolean {
  return (
    value.startsWith(API_KEY_PREFIX) &&
    value.length === API_KEY_PREFIX.length + API_KEY_RANDOM_LENGTH
  );
}

export function parseBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;

  return token;
}

export function apiKeyCacheKey(hash: string): string {
  return `ps:apikey:${hash}`;
}

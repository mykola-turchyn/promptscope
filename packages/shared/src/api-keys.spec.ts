import { describe, expect, it } from 'vitest';
import { generateApiKey, hashApiKey, isWellFormedApiKey, parseBearerToken } from './api-keys.ts';

describe('generateApiKey', () => {
  it('returns a key, its SHA-256 hash and a short display prefix', () => {
    const { key, hash, prefix } = generateApiKey();

    expect(isWellFormedApiKey(key)).toBe(true);
    expect(hash).toBe(hashApiKey(key));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(prefix).toBe(`${key.slice(0, 12)}…`);
  });

  it('never repeats keys', () => {
    expect(generateApiKey().key).not.toBe(generateApiKey().key);
  });
});

describe('parseBearerToken', () => {
  it('reads the token from a Bearer header', () => {
    expect(parseBearerToken('Bearer ps_live_abc')).toBe('ps_live_abc');
    expect(parseBearerToken('bearer ps_live_abc')).toBe('ps_live_abc');
  });

  it('rejects other schemes and empty headers', () => {
    expect(parseBearerToken('Basic abc')).toBeNull();
    expect(parseBearerToken(undefined)).toBeNull();
    expect(parseBearerToken('Bearer')).toBeNull();
  });
});

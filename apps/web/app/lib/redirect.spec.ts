import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from './redirect';

describe('safeRedirectPath', () => {
  it('keeps same-site paths', () => {
    expect(safeRedirectPath('/acme/support-bot/traces?status=error')).toBe(
      '/acme/support-bot/traces?status=error',
    );
  });

  it('rejects other origins and protocol-relative URLs', () => {
    expect(safeRedirectPath('https://evil.test')).toBe('/');
    expect(safeRedirectPath('//evil.test')).toBe('/');
    expect(safeRedirectPath(null, '/home')).toBe('/home');
  });
});

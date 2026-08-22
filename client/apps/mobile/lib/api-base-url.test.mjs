import { describe, expect, test } from 'vitest';

const { resolveApiBaseUrl } = await import('./api-base-url.ts');

/**
 * The bug this pins down: `.env` held `http://172.20.10.3:5001`, an address this
 * Mac stopped having when it left the phone's hotspot. Every request timed out,
 * every home block reported an error, and Home showed "We could not load the
 * store just now." over a perfectly healthy backend.
 *
 * A hand-maintained LAN IP rots every time the network changes. Expo already
 * knows the address the bundle is being served from — that is, by construction,
 * the machine running the dev backend — so the host is derived rather than typed.
 */

const DEV_HOST = '192.168.100.3:8081';

describe('resolveApiBaseUrl', () => {
  test('rejects a missing base url rather than fetching from nowhere', () => {
    expect(() => resolveApiBaseUrl(undefined, DEV_HOST)).toThrow(/EXPO_PUBLIC_API_URL/);
    expect(() => resolveApiBaseUrl('', DEV_HOST)).toThrow(/EXPO_PUBLIC_API_URL/);
  });

  test('retargets a stale LAN ip at the host actually serving the bundle', () => {
    // The exact failure: .env says one subnet, the Mac is on another.
    expect(resolveApiBaseUrl('http://172.20.10.3:5001', DEV_HOST)).toBe('http://192.168.100.3:5001');
  });

  test('keeps the configured port, not the dev server port', () => {
    // 8081 is Metro. The backend is 5001 and must stay 5001.
    expect(resolveApiBaseUrl('http://10.0.0.5:5001', DEV_HOST)).toContain(':5001');
    expect(resolveApiBaseUrl('http://10.0.0.5:5001', DEV_HOST)).not.toContain('8081');
  });

  test('retargets localhost, which on a physical device is the phone itself', () => {
    expect(resolveApiBaseUrl('http://localhost:5001', DEV_HOST)).toBe('http://192.168.100.3:5001');
    expect(resolveApiBaseUrl('http://127.0.0.1:5001', DEV_HOST)).toBe('http://192.168.100.3:5001');
  });

  test('leaves production alone even while a dev server is running', () => {
    // Rewriting this would point a release build at somebody's laptop.
    expect(resolveApiBaseUrl('https://backend.drinksharbour.com', DEV_HOST)).toBe(
      'https://backend.drinksharbour.com'
    );
  });

  test('leaves the configured url alone when there is no dev server', () => {
    // A production build has no hostUri; there is nothing better to fall back to.
    expect(resolveApiBaseUrl('http://192.168.1.50:5001', null)).toBe('http://192.168.1.50:5001');
    expect(resolveApiBaseUrl('http://192.168.1.50:5001', undefined)).toBe('http://192.168.1.50:5001');
  });

  test('reads a host out of a hostUri that carries a path', () => {
    expect(resolveApiBaseUrl('http://localhost:5001', '192.168.100.3:8081/--/expo')).toBe(
      'http://192.168.100.3:5001'
    );
  });

  test('trims trailing slashes so callers can concatenate paths', () => {
    expect(resolveApiBaseUrl('https://backend.drinksharbour.com/', DEV_HOST)).toBe(
      'https://backend.drinksharbour.com'
    );
  });

  test('ignores a hostUri it cannot make sense of', () => {
    expect(resolveApiBaseUrl('http://localhost:5001', '')).toBe('http://localhost:5001');
    expect(resolveApiBaseUrl('http://localhost:5001', ':::')).toBe('http://localhost:5001');
  });
});

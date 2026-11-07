import { afterEach, expect, test, vi } from 'vitest';
import {
  consolidateBills,
  joinParty,
  leaveParty,
  moveLines,
  moveVisit,
  releaseTable,
} from './transfers';
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

/** Fetcher contract mirrors the six S6 routes EXACTLY — path, method, body. */
async function capture(method: string, run: () => Promise<unknown>) {
  const fetcher = vi.fn(async (_url: string | URL | Request, _options?: RequestInit) => ({ ok: true, json: async () => ({ data: { ok: true } }) }));
  vi.stubGlobal('fetch', fetcher);
  await run();
  expect(fetcher).toHaveBeenCalledTimes(1);
  const [url, options] = fetcher.mock.calls[0];
  expect(String(url)).toContain('/api/venue-ops');
  expect((options as RequestInit).method).toBe(method);
  return { url: String(url).replace(/^.*\/api\/venue-ops/, ''), options: options as RequestInit };
}

test('the six S6 floor-transfer commands ride the registered routes verbatim', async () => {
  const move = await capture('POST', () => moveVisit('t', 's1', { targetTableIds: ['t1', 't2'], expectedVersion: 4 }));
  expect(move.url).toBe('/service-sessions/s1/move');
  expect(JSON.parse(move.options.body as string)).toEqual({ targetTableIds: ['t1', 't2'], expectedVersion: 4 });

  const release = await capture('POST', () => releaseTable('t', 's1', { outcome: 'cleared', expectedVersion: 4 }));
  expect(release.url).toBe('/service-sessions/s1/release-table');
  expect(JSON.parse(release.options.body as string)).toEqual({ outcome: 'cleared', expectedVersion: 4 });

  const join = await capture('POST', () => joinParty('t', 's1', { targetSessionId: 's2', expectedVersion: 4 }));
  expect(join.url).toBe('/service-sessions/s1/join');
  expect(JSON.parse(join.options.body as string)).toEqual({ targetSessionId: 's2', expectedVersion: 4 });

  const leave = await capture('POST', () => leaveParty('t', 's1', { expectedVersion: 4 }));
  expect(leave.url).toBe('/service-sessions/s1/leave-party');
  expect(JSON.parse(leave.options.body as string)).toEqual({ expectedVersion: 4 });

  const consolidate = await capture('POST', () => consolidateBills('t', 's1', { intoSessionId: 's2', expectedVersion: 4 }));
  expect(consolidate.url).toBe('/service-sessions/s1/consolidate');
  expect(JSON.parse(consolidate.options.body as string)).toEqual({ intoSessionId: 's2', expectedVersion: 4 });

  const lines = await capture('POST', () => moveLines('t', 's1', {
    lines: [{ lineId: 'l1', revision: 2, quantity: 1, toSessionId: 's2' }],
    repricingConsent: true, expectedVersion: 4,
  }));
  expect(lines.url).toBe('/service-sessions/s1/move-lines');
  expect(JSON.parse(lines.options.body as string)).toEqual({
    lines: [{ lineId: 'l1', revision: 2, quantity: 1, toSessionId: 's2' }],
    repricingConsent: true, expectedVersion: 4,
  });

  // Every command carries the shared Idempotency-Key idiom.
  expect((move.options.headers as Record<string, string>)['Idempotency-Key']).toBeTruthy();
});

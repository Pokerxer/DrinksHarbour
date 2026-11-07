import { afterEach, expect, test, vi } from 'vitest';
import { listGratuityAllocations, recordGratuityAllocation } from './gratuity';
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

/** Fetcher contract mirrors the S5 batch-3 routes EXACTLY — path, method, body. */
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

test('gratuity allocation commands ride the S5 receipt-anchored routes', async () => {
  const record = await capture('POST', () => recordGratuityAllocation('t', 's1', {
    receiptId: 'r1', sourceKind: 'payer', amountMinor: 5000, policyVersion: 2,
    shares: [{ staffId: 'u1', shareBps: 7000 }, { shiftId: 'sh1', shareBps: 3000 }], locationId: 'loc',
  }));
  expect(record.url).toBe('/service-sessions/s1/gratuity-allocations');
  expect(JSON.parse(record.options.body as string)).toEqual({
    receiptId: 'r1', sourceKind: 'payer', amountMinor: 5000, policyVersion: 2,
    shares: [{ staffId: 'u1', shareBps: 7000 }, { shiftId: 'sh1', shareBps: 3000 }], locationId: 'loc',
  });
  // The shared venueRequest idiom attaches the Idempotency-Key to every command.
  expect((record.options.headers as Record<string, string>)['Idempotency-Key']).toBeTruthy();
  const list = await capture('GET', () => listGratuityAllocations('t', 's1'));
  expect(list.url).toBe('/service-sessions/s1/gratuity-allocations');
  const scoped = await capture('GET', () => listGratuityAllocations('t', 's1', 'loc'));
  expect(scoped.url).toBe('/service-sessions/s1/gratuity-allocations?locationId=loc');
});

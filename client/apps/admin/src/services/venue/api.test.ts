import { afterEach, expect, test, vi } from 'vitest';
import { collectBill } from './api';
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
test('canonical_collection_uses_its_visit_route_and_reuses_the_request_identity', async () => {
  const fetcher = vi.fn(async (_url: string | URL | Request, _options?: RequestInit) => ({ ok: true, json: async () => ({ data: { state: 'pending', bill: { state: 'payment_pending' } } }) }));
  vi.stubGlobal('fetch', fetcher);
  const body = { expectedVersion: 3, quoteId: 'quote', method: 'paystack' as const, email: 'guest@test.local' };
  await collectBill('token', 'visit', body, 'pos'); await collectBill('token', 'visit', body, 'pos');
  expect(fetcher.mock.calls[0][0]).toContain('/api/pos/venue/service-sessions/visit/collections');
  const first = fetcher.mock.calls[0][1] as RequestInit;
  const second = fetcher.mock.calls[1][1] as RequestInit;
  expect((first.headers as Record<string, string>)['Idempotency-Key']).toBe((second.headers as Record<string, string>)['Idempotency-Key']);
});
test('simultaneous_navigation_and_checkout_share_one_accepted_lines_request', async () => {
  const { setLines } = await import('./api');
  const fetcher = vi.fn(async (_url: string | URL | Request, _options?: RequestInit) => ({ ok: true, json: async () => ({ data: { version: 3, lineVersion: 1 } }) })); vi.stubGlobal('fetch', fetcher);
  const body = { expectedVersion: 2, lines: [{ subProductId: 'sub', sizeId: 'size', quantity: 2 }] };
  await Promise.all([setLines('same-token', 'same-visit', body, 'pos'), setLines('same-token', 'same-visit', body, 'pos')]);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

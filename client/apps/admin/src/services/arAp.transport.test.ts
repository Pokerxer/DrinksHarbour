import { afterEach, expect, it, vi } from 'vitest';
import { arApService } from './arAp.service';
afterEach(() => vi.unstubAllGlobals());
it('customer receipts use the app origin instead of a second browser connection to port5001', async () => {
  const request = vi.fn(async (_url: string, _options?: RequestInit) =>
    Response.json({ success: true, data: [] })
  );
  vi.stubGlobal('fetch', request);
  await arApService.payments('test-token', 'customer', { page: 1 });
  expect(request.mock.calls[0][0]).toBe(
    '/api/accounting/payments?side=customer&page=1'
  );
});

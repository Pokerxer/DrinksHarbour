import { afterEach, expect, test, vi } from 'vitest';
import { dispatchRequest } from './local-dispatch.service';
afterEach(() => vi.unstubAllGlobals());
test('local dispatch uses its own authenticated API prefix and private transport', async () => {
  const fetcher = vi.fn(
    async () =>
      new Response(
        JSON.stringify({ success: true, data: { booking: { _id: 'own' } } }),
        { status: 200 }
      )
  );
  vi.stubGlobal('fetch', fetcher);
  await expect(
    dispatchRequest('signed', '/bookings/own/dispatch', 'POST', {
      expectedVersion: 1,
      idempotencyKey: 'same',
    })
  ).resolves.toEqual({ booking: { _id: 'own' } });
  expect(fetcher).toHaveBeenCalledWith(
    expect.stringMatching(
      /\/api\/merchant-local-dispatch\/bookings\/own\/dispatch$/
    ),
    expect.objectContaining({
      method: 'POST',
      cache: 'no-store',
      headers: {
        Authorization: 'Bearer signed',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expectedVersion: 1, idempotencyKey: 'same' }),
    })
  );
});
test('missing staff token cannot issue any delivery operation', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  await expect(dispatchRequest('', '/orders/own/options')).rejects.toThrow(
    /sign in/i
  );
  expect(fetcher).not.toHaveBeenCalled();
});

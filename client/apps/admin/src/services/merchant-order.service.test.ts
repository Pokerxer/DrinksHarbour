import { afterEach, expect, test, vi } from 'vitest';
afterEach(() => vi.unstubAllGlobals());
test('merchant requests require signed-in authority and preserve explicit operation version/key', async () => {
  const service = await import('./merchant-order.service').catch(() => ({
    merchantRequest: undefined,
  }));
  expect(service.merchantRequest).toBeTypeOf('function');
  const fetcher = vi.fn(async () => ({
    ok: true,
    json: async () => ({ data: { order: { _id: 'owned' } } }),
  }));
  vi.stubGlobal('fetch', fetcher);
  await expect(
    service.merchantRequest!('', '/owned/actions', 'POST', {
      action: 'accept',
      expectedVersion: 1,
      idempotencyKey: 'stable',
    })
  ).rejects.toThrow(/sign in/i);
  expect(fetcher).not.toHaveBeenCalled();
  await service.merchantRequest!('token', '/owned/actions', 'POST', {
    action: 'accept',
    expectedVersion: 1,
    idempotencyKey: 'stable',
  });
  expect(fetcher).toHaveBeenCalledWith(
    expect.stringContaining('/api/merchant-orders/owned/actions'),
    expect.objectContaining({
      cache: 'no-store',
      headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      body: JSON.stringify({
        action: 'accept',
        expectedVersion: 1,
        idempotencyKey: 'stable',
      }),
    })
  );
});
test('merchant money entry rejects fractions below the transaction minor unit', async () => {
  const service = await import('./merchant-order.service').catch(() => ({
    amountToMinor: undefined,
  }));
  expect(service.amountToMinor).toBeTypeOf('function');
  expect(service.amountToMinor!('12.34')).toBe(1234);
  for (const value of ['0', '1.001', 'abc', '-5'])
    expect(() => service.amountToMinor!(value)).toThrow();
});

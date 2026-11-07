import { afterEach, expect, it, vi } from 'vitest';
import { orderService, type CreateOrderPayload } from './order.service';
afterEach(() => vi.unstubAllGlobals());
it('retains checkout identity and authentication on the real transport', async () => {
  const requests: RequestInit[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    requests.push(init);
    return { ok: true, json: async () => ({ success: true, data: { order: { _id: 'saved-order' } } }) };
  }));
  const payload = { paymentMethod: 'cash_on_delivery', items: [] } as unknown as CreateOrderPayload;
  await orderService.createOrder('fixture-token', payload, 'same-checkout');
  await orderService.createOrder('fixture-token', payload, 'same-checkout');
  for (const request of requests) {
    expect(new Headers(request.headers).get('Idempotency-Key')).toBe('same-checkout');
    expect(new Headers(request.headers).get('Authorization')).toBe('Bearer fixture-token');
  }
});

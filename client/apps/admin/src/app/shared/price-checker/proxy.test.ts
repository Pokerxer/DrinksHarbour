import { afterEach, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../../api/price-checker/[...path]/route';
const context = (action: string) => ({ params: Promise.resolve({ path: ['test-store', action] }) });
const request = (action: string, headers: Record<string, string> = {}, body = '{}') =>
  new NextRequest(`https://www.drinksharbour.com/api/price-checker/test-store/${action}`, {
    method: 'POST',
    headers: {
      origin: 'https://www.drinksharbour.com',
      'Content-Type': 'application/json',
      ...headers,
    },
    body,
  });
afterEach(() => vi.unstubAllGlobals());
test('session token is stored in HttpOnly scoped cookie and never returned in public JSON', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            token: 'secret-device-token',
            data: { slug: 'test-store' },
          }),
          { status: 200 }
        )
      )
  );
  const res = await POST(request('session'), context('session'));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ success: true, data: { slug: 'test-store' } });
  const cookie = res.headers.get('set-cookie');
  expect(cookie).toContain('HttpOnly');
  expect(cookie).toContain('SameSite=strict');
  expect(cookie).toContain('Path=/api/price-checker/test-store');
});
test('only the kiosk cookie is forwarded; customer credentials never reach the scan API', async () => {
  let sentHeaders: Record<string, string> = {};
  vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
    sentHeaders = init.headers as Record<string, string>;
    return new Response(JSON.stringify({ success: true, data: { found: false } }), { status: 200 });
  });
  const res = await POST(
    request(
      'scan',
      {
        cookie: 'dh_price_checker_test-store=kiosk-secret; dh_access=customer-secret',
        authorization: 'Bearer admin-secret',
      },
      JSON.stringify({ barcode: '00123', requestId: 'request-000000001' })
    ),
    context('scan')
  );
  expect(res.status).toBe(200);
  expect(sentHeaders['X-Price-Checker-Session']).toBe('kiosk-secret');
  expect(sentHeaders).not.toHaveProperty('Authorization');
  expect(sentHeaders).not.toHaveProperty('Cookie');
});
test('foreign origins and administrative paths are denied without contacting upstream', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  expect(
    (await POST(request('scan', { origin: 'https://foreign.invalid' }), context('scan'))).status
  ).toBe(403);
  expect((await POST(request('delete'), context('delete'))).status).toBe(404);
  expect(fetcher).not.toHaveBeenCalled();
});

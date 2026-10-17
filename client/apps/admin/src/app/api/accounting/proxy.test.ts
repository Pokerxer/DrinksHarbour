import { afterEach, expect, it, vi } from 'vitest';
import { GET, POST } from './[...path]/route';
afterEach(() => vi.unstubAllGlobals());
it('forwards the payment request and trusted auth headers without forwarding browser cookies', async () => {
  const upstream = vi.fn(async () =>
    Response.json({ success: true, data: [{ number: 'POS-1' }] })
  );
  vi.stubGlobal('fetch', upstream);
  const result = await GET(
    new Request(
      'http://localhost:3000/api/accounting/payments?side=customer&page=1',
      {
        headers: {
          Authorization: 'Bearer test-token',
          Cookie: 'private-session',
          'x-tenant-slug': 'wyncity',
        },
      }
    ),
    { params: Promise.resolve({ path: ['payments'] }) }
  );
  const [url, options] = upstream.mock.calls[0] as unknown as [
    string,
    RequestInit,
  ];
  expect(url).toBe(
    'http://localhost:5001/api/accounting/payments?side=customer&page=1'
  );
  const headers = new Headers(options.headers);
  expect(headers.get('authorization')).toBe('Bearer test-token');
  expect(headers.get('cookie')).toBeNull();
  expect(headers.get('x-tenant-slug')).toBe('wyncity');
  expect(result.status).toBe(200);
  expect(await result.json()).toEqual({
    success: true,
    data: [{ number: 'POS-1' }],
  });
});
it('payment writes are forwarded exactly once, including side and allocations', async () => {
  const upstream = vi.fn(async () =>
    Response.json({ success: true }, { status: 201 })
  );
  vi.stubGlobal('fetch', upstream);
  const body = JSON.stringify({ side: 'vendor', amount: 50, allocations: [] });
  const result = await POST(
    new Request('http://localhost:3000/api/accounting/payments', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body,
    }),
    { params: Promise.resolve({ path: ['payments'] }) }
  );
  expect(upstream).toHaveBeenCalledTimes(1);
  expect(result.status).toBe(201);
  const options = (
    upstream.mock.calls[0] as unknown as [string, RequestInit]
  )[1];
  expect(new TextDecoder().decode(options.body as ArrayBuffer)).toBe(body);
});
it('an unavailable backend returns a readable no-store error instead of dropping the browser fetch', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new TypeError('fetch failed');
    })
  );
  const result = await GET(
    new Request('http://localhost:3000/api/accounting/payments'),
    { params: Promise.resolve({ path: ['payments'] }) }
  );
  expect(result.status).toBe(503);
  expect(result.headers.get('cache-control')).toContain('no-store');
  expect(await result.json()).toMatchObject({ message: expect.stringMatching(/Accounting server could not be reached/) });
});
it('upstream auth failure stays an auth failure and path traversal never leaves Accounting', async () => {
  const upstream = vi.fn(async () =>
    Response.json(
      { success: false, message: 'Not authorized' },
      { status: 401 }
    )
  );
  vi.stubGlobal('fetch', upstream);
  const result = await GET(
    new Request('http://localhost:3000/api/accounting/payments'),
    { params: Promise.resolve({ path: ['payments'] }) }
  );
  expect(result.status).toBe(401);
  const bad = await GET(
    new Request('http://localhost:3000/api/accounting/payments'),
    { params: Promise.resolve({ path: ['..', 'users'] }) }
  );
  expect(bad.status).toBe(400);
  expect(upstream).toHaveBeenCalledTimes(1);
});
it('a disconnected write is not replayed and asks the operator to check records before retrying', async () => {
  const upstream = vi.fn(async () => {
    throw new TypeError('fetch failed');
  });
  vi.stubGlobal('fetch', upstream);
  const result = await POST(
    new Request('http://localhost:3000/api/accounting/payments', {
      method: 'POST',
      body: '{}',
    }),
    { params: Promise.resolve({ path: ['payments'] }) }
  );
  expect(upstream).toHaveBeenCalledTimes(1);
  expect(await result.json()).toMatchObject({ message: expect.stringMatching(/could not be confirmed.*Refresh records/) });
});

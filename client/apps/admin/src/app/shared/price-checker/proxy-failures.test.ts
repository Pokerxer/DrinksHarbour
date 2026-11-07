import { afterEach, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../../api/price-checker/[...path]/route';

afterEach(() => vi.unstubAllGlobals());
const context = (action: string) => ({
  params: Promise.resolve({ path: ['counter', action] }),
});
const request = (action: string, body = '{}') =>
  new NextRequest(
    `https://admin.drinksharbour.com/api/price-checker/counter/${action}`,
    {
      method: 'POST',
      body,
      headers: {
        origin: 'https://admin.drinksharbour.com',
        cookie: 'dh_price_checker_counter=session-token',
        'Content-Type': 'application/json',
      },
    }
  );

test.each(['session', 'scan'])(
  'malformed upstream %s JSON is a retryable service failure',
  async (action) => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('invalid upstream JSON', { status: 200 })
        )
    );
    const result = await POST(request(action), context(action));
    expect(result.status).toBe(503);
    expect(await result.json()).toEqual({ success: false });
    expect(result.headers.get('set-cookie')).toBeNull();
  }
);

test('malformed client scan JSON stays a 400 without an upstream request', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  expect((await POST(request('scan', '{'), context('scan'))).status).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
});

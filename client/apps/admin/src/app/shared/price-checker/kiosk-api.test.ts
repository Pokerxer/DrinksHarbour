import { afterEach, expect, test, vi } from 'vitest';
import { checkPrice } from '../../../components/price-checker/api';
afterEach(() => vi.unstubAllGlobals());
test('transient scan failure retries once with the same scan identifier', async () => {
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new TypeError('network lost'))
    .mockResolvedValueOnce(new Response(JSON.stringify({ data: { found: false } })));
  vi.stubGlobal('fetch', fetcher);
  await checkPrice('counter', '00123', 'scan-unique', new AbortController().signal);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[0][1].body).toBe(fetcher.mock.calls[1][1].body);
});
test('caller cancellation and permanent errors never retry', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 403 }));
  vi.stubGlobal('fetch', fetcher);
  await expect(
    checkPrice('counter', '00123', 'scan-unique', new AbortController().signal)
  ).rejects.toMatchObject({ status: 403 });
  expect(fetcher).toHaveBeenCalledTimes(1);
  fetcher.mockReset().mockRejectedValue(new DOMException('Cancelled', 'AbortError'));
  const controller = new AbortController();
  controller.abort();
  await expect(checkPrice('counter', '00123', 'scan-unique', controller.signal)).rejects.toThrow();
  expect(fetcher.mock.calls.length).toBeLessThanOrEqual(1);
});

test('expired sessions refresh once and preserve the original scan ID', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response('{}', { status: 401 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ data: { slug: 'counter' } })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ data: { found: false } })));
  vi.stubGlobal('fetch', fetcher);
  await checkPrice('counter', '00123', 'scan-unique', new AbortController().signal);
  expect(fetcher.mock.calls[1][0]).toContain('/session');
  expect(fetcher.mock.calls[0][1].body).toBe(fetcher.mock.calls[2][1].body);
});

test('persistent service failure stops after one retry', async () => {
  const fetcher = vi.fn().mockImplementation(async () => new Response('{}', { status: 503 }));
  vi.stubGlobal('fetch', fetcher);
  await expect(
    checkPrice('counter', '00123', 'scan-unique', new AbortController().signal)
  ).rejects.toMatchObject({ status: 503 });
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test('a stalled connection is bounded and cannot leave the kiosk loading forever', async () => {
  vi.useFakeTimers();
  try {
    const fetcher = vi.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Timed out', 'AbortError')),
            { once: true }
          );
        })
    );
    vi.stubGlobal('fetch', fetcher);
    const result = expect(
      checkPrice('counter', '00123', 'scan-unique', new AbortController().signal)
    ).rejects.toMatchObject({ status: 503 });
    await vi.advanceTimersByTimeAsync(30000);
    await result;
    expect(fetcher).toHaveBeenCalledTimes(2);
  } finally {
    vi.useRealTimers();
  }
});

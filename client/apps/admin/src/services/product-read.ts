export class ProductReadError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'ProductReadError';
  }
}

function waitForRetry(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(
        signal?.reason ?? new DOMException('Request cancelled', 'AbortError')
      );
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, ms);
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
  });
}

/** Retry a product GET once on 503; never retry authentication failures or writes. */
export async function readProduct(
  url: string,
  token: string,
  signal?: AbortSignal
) {
  for (let attempt = 0; attempt < 2; attempt++) {
    signal?.throwIfAborted();
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
    if (response.ok) return response.json();
    const body: unknown = await response.json().catch(() => null);
    if (response.status === 503 && attempt === 0) {
      const seconds = Number(response.headers.get('Retry-After') ?? 5);
      const delay = Number.isFinite(seconds)
        ? Math.min(10, Math.max(1, seconds))
        : 5;
      await waitForRetry(delay * 1000, signal);
      continue;
    }
    const message =
      body &&
      typeof body === 'object' &&
      'message' in body &&
      typeof body.message === 'string'
        ? body.message
        : 'Failed to fetch product';
    throw new ProductReadError(message, response.status);
  }
  throw new ProductReadError('Failed to fetch product', 503);
}

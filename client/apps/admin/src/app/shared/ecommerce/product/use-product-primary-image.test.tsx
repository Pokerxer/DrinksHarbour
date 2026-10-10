// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useProductPrimaryImage } from './use-product-primary-image';
import { normalizePrimaryImages } from './primary-image';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const images = [
  {
    url: '/first.jpg',
    publicId: 'products/first',
    isPrimary: true,
    caption: 'Keep me',
  },
  { url: '/second.jpg', isPrimary: false, width: 800 },
];

describe('primary image persistence', () => {
  it('saves a URL-only image with exactly one primary, retaining media metadata', async () => {
    const changed = vi.fn();
    const saved = images.map((image, index) => ({
      ...image,
      isPrimary: index === 1,
    }));
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { product: { images: saved } } }))
      );
    vi.stubGlobal('fetch', fetcher);
    const { result } = renderHook(() =>
      useProductPrimaryImage('product-id', images, 'token', changed)
    );
    await act(() => result.current.makePrimary(1));
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toContain('/api/products/product-id');
    expect(init.method).toBe('PUT');
    expect(init.headers.Authorization).toBe('Bearer token');
    expect(JSON.parse(init.body)).toEqual({ images: saved });
    expect(changed).toHaveBeenCalledWith(saved);
    expect(images[0].isPrimary).toBe(true);
    expect(result.current.isSavingPrimary).toBe(false);
  });
  it('retains the previous primary and shows a retryable error on failure', async () => {
    const changed = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Forbidden' }), {
          status: 403,
        })
      )
    );
    const { result } = renderHook(() =>
      useProductPrimaryImage('p', images, 'token', changed)
    );
    await act(() => result.current.makePrimary(1));
    expect(changed).not.toHaveBeenCalled();
    expect(result.current.primaryError).toBe('Forbidden');
    expect(result.current.isSavingPrimary).toBe(false);
  });
  it('prevents overlapping saves', async () => {
    let finish!: (response: Response) => void;
    const fetcher = vi.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        finish = resolve;
      })
    );
    vi.stubGlobal('fetch', fetcher);
    const { result } = renderHook(() =>
      useProductPrimaryImage('p', images, 'token', vi.fn())
    );
    act(() => {
      void result.current.makePrimary(1);
      void result.current.makePrimary(1);
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async () =>
      finish(new Response(JSON.stringify({ data: { product: { images } } })))
    );
    await waitFor(() => expect(result.current.isSavingPrimary).toBe(false));
  });
  it('does not write without a token or with an invalid selection', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const { result } = renderHook(() =>
      useProductPrimaryImage('p', images, undefined, vi.fn())
    );
    await act(() => result.current.makePrimary(1));
    expect(fetcher).not.toHaveBeenCalled();
    const authenticated = renderHook(() =>
      useProductPrimaryImage('p', images, 'token', vi.fn())
    );
    await act(() => authenticated.result.current.makePrimary(-1));
    await act(() => authenticated.result.current.makePrimary(99));
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('preserves an explicit primary during edit serialization and repairs duplicate flags', () => {
    const selected = [
      { ...images[0], isPrimary: false },
      { ...images[1], isPrimary: true },
    ];
    expect(
      normalizePrimaryImages(selected).map((image) => image.isPrimary)
    ).toEqual([false, true]);
    expect(
      normalizePrimaryImages(
        images.map((image) => ({ ...image, isPrimary: true }))
      ).map((image) => image.isPrimary)
    ).toEqual([true, false]);
    expect(
      normalizePrimaryImages(
        images.map((image) => ({ ...image, isPrimary: false }))
      ).map((image) => image.isPrimary)
    ).toEqual([true, false]);
    expect(normalizePrimaryImages([])).toEqual([]);
  });
});

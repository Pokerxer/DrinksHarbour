// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import downloadProductImage from './image-download';

function stubAnchor() {
  const created: HTMLAnchorElement[] = [];
  const original = document.createElement.bind(document);
  const createElement = vi
    .spyOn(document, 'createElement')
    .mockImplementation((tag: string, options?: ElementCreationOptions) => {
      const element = original(tag, options);
      if (tag === 'a') {
        const anchor = element as HTMLAnchorElement;
        anchor.click = vi.fn();
        created.push(anchor);
      }
      return element;
    });
  vi.spyOn(document.body, 'appendChild').mockImplementation(<T extends Node>(node: T) => node);
  return { created, createElement };
}

beforeEach(() => {
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:mock-object-url'),
    revokeObjectURL: vi.fn(),
  } as unknown as typeof URL);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

import { cleanup } from '@testing-library/react';

it('fetches the image and triggers a download of the original bytes', async () => {
  const blob = new Blob(['original-bytes'], { type: 'image/webp' });
  const fetcher = vi.fn().mockResolvedValue({ ok: true, blob: async () => blob });
  vi.stubGlobal('fetch', fetcher);
  const { created } = stubAnchor();

  await downloadProductImage('https://res.cloudinary.com/demo/image/upload/v1/harbour/akpeteshie-75cl.webp');

  expect(fetcher).toHaveBeenCalledWith(
    'https://res.cloudinary.com/demo/image/upload/v1/harbour/akpeteshie-75cl.webp',
    expect.objectContaining({ mode: 'cors' })
  );
  expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
  expect(created).toHaveLength(1);
  expect(created[0].download).toBe('akpeteshie-75cl.webp');
  expect(created[0].href).toBe('blob:mock-object-url');
  expect(created[0].click).toHaveBeenCalledTimes(1);
});

it('falls back to the direct URL when the fetch is blocked (CORS/offline)', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
  const { created } = stubAnchor();

  await downloadProductImage('https://res.cloudinary.com/demo/image/upload/v1/harbour/star-beer-330ml.png', 'star-beer-fallback');

  expect(created).toHaveLength(1);
  expect(created[0].href).toBe('https://res.cloudinary.com/demo/image/upload/v1/harbour/star-beer-330ml.png');
  expect(created[0].download).toBe('star-beer-fallback');
});

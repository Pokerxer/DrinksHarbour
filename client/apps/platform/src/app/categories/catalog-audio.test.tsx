import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import CategoryPage from './[slug]/page';
import SubcategoryPage from './[slug]/[subSlug]/page';

const { speech } = vi.hoisted(() => ({ speech: vi.fn() }));
vi.mock('@/lib/fetchWithAuth', () => ({ fetchWithAuth: speech }));
vi.mock('@/lib/api', () => ({ API_URL: 'https://api.example.test' }));
vi.mock('@/app/fonts', () => ({ fraunces: { className: 'font-test' } }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); speech.mockReset(); });

const pages = [
  { subject: 'category information', page: () => CategoryPage({ params: Promise.resolve({ slug: 'wine' }) }) },
  { subject: 'subcategory information', page: () => SubcategoryPage({ params: Promise.resolve({ slug: 'wine', subSlug: 'red-wine' }) }) },
];

function setup(description: string, shortDescription = '') {
  const entity = { _id: 'catalog-id', slug: 'wine', name: 'Wine', description, shortDescription,
    parent: { _id: 'parent-id', slug: 'wine', name: 'Wine' } };
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true,
    json: async () => ({ data: url.includes('/slug/') ? entity : [] }),
  })));
  class AudioStub extends EventTarget { pause = vi.fn(); play = vi.fn(async () => {}); }
  vi.stubGlobal('Audio', AudioStub);
  vi.stubGlobal('URL', Object.assign(URL, {
    createObjectURL: vi.fn(() => 'blob:catalog'), revokeObjectURL: vi.fn(),
  }));
  speech.mockResolvedValue({ ok: true, blob: async () => new Blob(['audio']) });
}

it.each(pages)('reads complete $subject only after activation, excluding markup and link URLs', async ({ subject, page }) => {
  setup('<p>Explore <a href="/brands/house">House</a> &amp; its craft.</p><p>Full second paragraph.</p>');
  render(await page());
  expect(speech).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: `Listen to ${subject}` }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe(`Reading ${subject}`));
  expect(JSON.parse(speech.mock.calls[0][1].body).text).toBe('Explore House & its craft. Full second paragraph.');
  fireEvent.click(screen.getByRole('button', { name: `Stop reading ${subject}` }));
  expect(speech.mock.calls[0][1].signal.aborted).toBe(true);
});

it.each(pages)('uses the short description when $subject has no long description', async ({ subject, page }) => {
  setup('', '<p>A concise catalog introduction.</p>');
  render(await page());
  fireEvent.click(screen.getByRole('button', { name: `Listen to ${subject}` }));
  await waitFor(() => expect(speech).toHaveBeenCalledOnce());
  expect(JSON.parse(speech.mock.calls[0][1].body).text).toBe('A concise catalog introduction.');
});

it.each(pages)('does not offer empty $subject narration', async ({ subject, page }) => {
  setup('');
  render(await page());
  expect(screen.queryByRole('button', { name: `Listen to ${subject}` })).toBeNull();
  expect(speech).not.toHaveBeenCalled();
});

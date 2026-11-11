import { afterEach, expect, it } from 'vitest';
import { clearGiftMessage, giftCheckoutPath, readGiftMessage, saveGiftMessage } from '@/lib/giftCartDraft';

const id = '1f0e4a46-4d88-4d66-9ba4-a6ec8246da3a';

afterEach(() => sessionStorage.clear());

it('carries wrapping and the draft reference through sign-in without putting the note in the URL', () => {
  expect(saveGiftMessage(sessionStorage, id, 'Happy birthday!', 100)).toBe(true);
  const path = giftCheckoutPath(new URLSearchParams({ gift: '1', wrap: '1', draft: id, message: 'Happy birthday!' }));
  expect(path).toBe(`/checkout?gift=1&wrap=1&draft=${id}`);
  const loginPath = `/login?redirect=${encodeURIComponent(path)}`;
  const returned = new URL(loginPath, 'https://example.test').searchParams.get('redirect')!;
  expect(readGiftMessage(sessionStorage, new URL(returned, 'https://example.test').searchParams.get('draft'), 101)).toBe('Happy birthday!');
});

it('requires the matching draft, expires it, and clears it after completion', () => {
  saveGiftMessage(sessionStorage, id, 'A gift for you', 100);
  expect(readGiftMessage(sessionStorage, null, 101)).toBe('');
  expect(readGiftMessage(sessionStorage, id, 100 + 30 * 60 * 1000)).toBe('');
  clearGiftMessage(sessionStorage, id);
  expect(readGiftMessage(sessionStorage, id, 101)).toBe('');
  expect(giftCheckoutPath(new URLSearchParams({ wrap: '1', draft: id }))).toBe('/checkout');
});

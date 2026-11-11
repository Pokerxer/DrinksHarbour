import { GIFT_MESSAGE_MAX } from './giftCheckout';

const KEY = 'dh-cart-gift-draft';
const TTL = 30 * 60 * 1000;
const validId = (id: string | null): id is string => !!id && /^[\da-f-]{36}$/i.test(id);

export function giftCheckoutPath(params: URLSearchParams) {
  if (params.get('gift') !== '1') return '/checkout';
  const query = new URLSearchParams({ gift: '1' });
  if (params.get('wrap') === '1') query.set('wrap', '1');
  const id = params.get('draft');
  if (validId(id)) query.set('draft', id);
  return `/checkout?${query}`;
}

export function saveGiftMessage(storage: Storage, id: string, message: string, now = Date.now()) {
  if (!validId(id)) return false;
  try {
    storage.setItem(KEY, JSON.stringify({ id, message: message.slice(0, GIFT_MESSAGE_MAX), expiresAt: now + TTL }));
    return true;
  } catch { return false; }
}

export function readGiftMessage(storage: Storage, id: string | null, now = Date.now()) {
  if (!validId(id)) return '';
  try {
    const draft = JSON.parse(storage.getItem(KEY) || 'null');
    return draft?.id === id && Number.isFinite(draft.expiresAt) && draft.expiresAt > now &&
      typeof draft.message === 'string' ? draft.message.slice(0, GIFT_MESSAGE_MAX) : '';
  } catch { return ''; }
}

export function clearGiftMessage(storage: Storage, id?: string | null) {
  try {
    if (id === undefined || (validId(id) && JSON.parse(storage.getItem(KEY) || 'null')?.id === id)) storage.removeItem(KEY);
  } catch { /* Storage may be disabled. */ }
}

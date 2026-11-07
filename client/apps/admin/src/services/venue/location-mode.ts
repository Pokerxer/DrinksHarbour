import { readActiveShop } from '@/app/shared/point-of-sale/shop-scope';
import { venueRequest } from './api';
export async function locationMode(token: string) {
  const shop = readActiveShop();
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))), b => b.toString(16).padStart(2, '0')).join('');
  const key = `venue-location-mode:${digest}:${shop}`;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    try { return localStorage.getItem(key) === 'canonical'; } catch { return false; }
  }
  const result = await venueRequest<{ canonicalCheckoutEnabled: boolean }>(token, `/location-mode?shopId=${encodeURIComponent(shop)}`, 'GET', undefined, 'pos');
  try { localStorage.setItem(key, result.canonicalCheckoutEnabled ? 'canonical' : 'legacy'); } catch { /* private browser */ }
  return result.canonicalCheckoutEnabled;
}

import { describe, it, expect } from 'vitest';
import { scopePOSRequest, shopStorageKey } from './shop-scope';
describe('shop ownership at the client boundary', () => {
  it('keeps carts separate between same-mode shops and tenants', () => {
    expect(new Set([shopStorageKey('a', 'shop-a'), shopStorageKey('a', 'shop-b'), shopStorageKey('b', 'shop-a')]).size).toBe(3);
  });
  it('retains the original shop when replaying an offline sale', () => {
    const url = scopePOSRequest('http://localhost/api/pos/orders', { body: JSON.stringify({ shopId: 'original' }) }, 'current');
    expect(new URL(url).searchParams.get('shopId')).toBe('original');
  });
  it('uses the dashboard card shop instead of current shop', () => {
    expect(new URL(scopePOSRequest('http://localhost/api/pos/session-info?shopId=card', undefined, 'current')).searchParams.get('shopId')).toBe('card');
  });
  it('does not add shop ownership to login requests', () => {
    expect(scopePOSRequest('http://localhost/api/pos/auth/staff-login', undefined, 'current')).toBe('http://localhost/api/pos/auth/staff-login');
  });
});

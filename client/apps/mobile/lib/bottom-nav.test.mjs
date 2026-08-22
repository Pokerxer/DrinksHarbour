import { describe, expect, test } from 'vitest';

const { NAV_ITEMS, isNavItemActive, navItem } = await import('./bottom-nav.ts');

/**
 * Parity target: `apps/platform/src/components/Navigation/MobileBottomNav.tsx`.
 * Five tabs, in web order, with the web's own active rule:
 *   href === "/" ? pathname === "/" : pathname.startsWith(href)
 * plus "Categories is active while its drawer is open".
 */

describe('NAV_ITEMS', () => {
  test('is the five web tabs in web order', () => {
    expect(NAV_ITEMS.map((i) => i.id)).toEqual([
      'home',
      'categories',
      'profile',
      'cart',
      'chatbot',
    ]);
  });

  test('carries the web labels verbatim', () => {
    expect(NAV_ITEMS.map((i) => i.label)).toEqual(['Home', 'Categories', 'Me', 'Cart', 'Chat']);
  });

  test('only the routed tabs have a route — categories and chat are actions', () => {
    expect(navItem('home').route).toBe('/');
    expect(navItem('profile').route).toBe('/account');
    expect(navItem('cart').route).toBe('/cart');
    expect(navItem('categories').route).toBeUndefined();
    expect(navItem('chatbot').route).toBeUndefined();
  });

  test('every tab names a distinct outline and filled icon', () => {
    for (const item of NAV_ITEMS) {
      expect(item.icon, item.id).toBeTruthy();
      expect(item.activeIcon, item.id).toBeTruthy();
      expect(item.icon).not.toBe(item.activeIcon);
    }
  });
});

describe('isNavItemActive', () => {
  test('Home matches only the exact root, never every route', () => {
    // The web guards this specially; startsWith("/") would light Home up everywhere.
    expect(isNavItemActive(navItem('home'), '/', false)).toBe(true);
    expect(isNavItemActive(navItem('home'), '/cart', false)).toBe(false);
    expect(isNavItemActive(navItem('home'), '/account', false)).toBe(false);
  });

  test('a routed tab matches its own subtree', () => {
    expect(isNavItemActive(navItem('cart'), '/cart', false)).toBe(true);
    expect(isNavItemActive(navItem('profile'), '/account', false)).toBe(true);
    expect(isNavItemActive(navItem('profile'), '/account/orders', false)).toBe(true);
    expect(isNavItemActive(navItem('profile'), '/cart', false)).toBe(false);
  });

  test('Categories is active only while its drawer is open', () => {
    expect(isNavItemActive(navItem('categories'), '/', false)).toBe(false);
    expect(isNavItemActive(navItem('categories'), '/', true)).toBe(true);
  });

  test('an open drawer does not steal the active state from other tabs', () => {
    expect(isNavItemActive(navItem('cart'), '/cart', true)).toBe(true);
    expect(isNavItemActive(navItem('chatbot'), '/cart', true)).toBe(false);
  });
});

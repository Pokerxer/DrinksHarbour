import { afterEach, expect, it, vi } from 'vitest';
import { productWebsiteUrl } from './website-preview';
afterEach(() => vi.unstubAllEnvs());
it('points to the platform product slug route rather than the admin origin', () => {
  vi.stubEnv('NEXT_PUBLIC_PLATFORM_URL', 'http://localhost:3001/');
  expect(productWebsiteUrl('glenfiddich-15')).toBe('http://localhost:3001/product/glenfiddich-15');
});
it('defaults to the production platform and safely encodes the slug', () => {
  vi.stubEnv('NEXT_PUBLIC_PLATFORM_URL', '');
  expect(productWebsiteUrl('glenfiddich 15/reserve')).toBe('https://drinksharbour.com/product/glenfiddich%2015%2Freserve');
});
it('does not invent a product URL before a saved slug exists', () => {
  expect(productWebsiteUrl(undefined)).toBeNull();
  expect(productWebsiteUrl('   ')).toBeNull();
});
it('rejects an invalid or non-web platform address', () => {
  vi.stubEnv('NEXT_PUBLIC_PLATFORM_URL', 'javascript:alert(1)');
  expect(productWebsiteUrl('glenfiddich-15')).toBeNull();
  vi.stubEnv('NEXT_PUBLIC_PLATFORM_URL', 'not a url');
  expect(productWebsiteUrl('glenfiddich-15')).toBeNull();
});

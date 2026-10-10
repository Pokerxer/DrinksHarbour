import { expect, it } from 'vitest';
import { subProductListImage } from './list-image';

it('requests bounded automatically compressed Cloudinary list images', () => {
  const url = 'https://res.cloudinary.com/drinks/image/upload/v42/bottle.jpg';
  expect(subProductListImage(url, 320)).toBe('https://res.cloudinary.com/drinks/image/upload/f_auto,q_auto,c_limit,w_320/v42/bottle.jpg');
  expect(subProductListImage(url, 72)).toContain('w_72');
});
it('preserves signed, non-Cloudinary, private and already transformed assets', () => {
  for (const url of ['https://example.com/image.jpg', '/local.jpg',
    'https://res.cloudinary.com/drinks/image/upload/s--signature--/v42/bottle.jpg',
    'https://res.cloudinary.com/drinks/image/authenticated/v42/bottle.jpg',
    'https://res.cloudinary.com/drinks/image/upload/w_200/v42/bottle.jpg']) {
    expect(subProductListImage(url, 320)).toBe(url);
  }
});

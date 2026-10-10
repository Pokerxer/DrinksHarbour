// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import SubProductImage from './sub-product-list/components/SubProductImage';
afterEach(cleanup);
it('loads list images lazily and retries the original if its derivative is unavailable', () => {
  const url = 'https://res.cloudinary.com/drinks/image/upload/v42/bottle.jpg';
  render(<SubProductImage sp={{ product: { images: [{ url }] } }} alt="Bottle" fallback={<span>Missing</span>} />);
  const img = screen.getByAltText('Bottle');
  expect(img.getAttribute('loading')).toBe('lazy');
  expect(img.getAttribute('decoding')).toBe('async');
  expect(img.getAttribute('src')).toContain('w_320');
  fireEvent.error(img);
  expect(img.getAttribute('src')).toBe(url);
  fireEvent.error(img);
  expect(screen.getByText('Missing')).toBeTruthy();
});

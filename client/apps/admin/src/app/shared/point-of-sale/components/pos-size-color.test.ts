import { expect, test } from 'vitest';
import { variantLabel } from './pos-size-color';

test('till and cart labels distinguish options sharing a size and colour', () => {
  const size = { displayName: '256 GB', colorName: 'Black' };
  expect(variantLabel({ ...size, optionName: 'Wi-Fi' })).toBe('256 GB · Black · Wi-Fi');
  expect(variantLabel({ ...size, optionName: 'Cellular' })).toBe('256 GB · Black · Cellular');
  expect(variantLabel({ displayName: '500 ml' })).toBe('500 ml');
});

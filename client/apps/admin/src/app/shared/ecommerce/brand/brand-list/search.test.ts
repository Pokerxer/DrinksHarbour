import { expect, test } from 'vitest';
import { matchesBrandSearch } from './search';
test('brand list matches both reported names despite case and surrounding spaces', () => {
  expect(
    matchesBrandSearch(
      { name: 'Glenfiddich', slug: 'glenfiddich' },
      '  GLENFIDDICH '
    )
  ).toBe(true);
  expect(
    matchesBrandSearch({ name: 'Laphroaig', slug: 'laphroaig' }, 'laph')
  ).toBe(true);
  expect(
    matchesBrandSearch({ name: 'Laphroaig', slug: 'laphroaig' }, 'glen')
  ).toBe(false);
});
test('brand list searches slugs and treats empty input as all brands', () => {
  expect(
    matchesBrandSearch(
      { name: 'The Distillery', slug: 'laphroaig' },
      'laphroaig'
    )
  ).toBe(true);
  expect(matchesBrandSearch({ name: 'Glenfiddich', slug: '' }, '  ')).toBe(
    true
  );
});

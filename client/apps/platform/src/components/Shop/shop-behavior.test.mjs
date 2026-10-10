import test from 'node:test';
import assert from 'node:assert/strict';
import { readShopFilters } from './filterQuery.ts';
import { resolveShopArtwork } from './bannerArtwork.ts';

test('URL restores price, ABV, rating, size and volume together', () => {
  const filters = readShopFilters(new URLSearchParams('minPrice=15000&maxPrice=250000&minABV=12.5&maxABV=40&minRating=4&size=750ml&volume=700-1000'), { min: 0, max: 900000 });
  assert.deepEqual(filters.priceRange, { min: 15000, max: 250000 });
  assert.deepEqual(filters.abvRange, { min: 12.5, max: 40 });
  assert.equal(filters.minRating, 4);
  assert.equal(filters.size, '750ml');
  assert.equal(filters.volumeRange, '700-1000');
});
test('cleared URL resets ranges and other selections to catalog defaults', () => {
  const filters = readShopFilters(new URLSearchParams(), { min: 500, max: 900000 });
  assert.deepEqual(filters.priceRange, { min: 500, max: 900000 });
  for (const key of ['size', 'volumeRange', 'abvRange', 'minRating']) assert.equal(filters[key], null);
});
test('missing category artwork allows the main shop banner fallback', () => {
  assert.equal(resolveShopArtwork([{ bannerImage: { url: '' } }]), null);
});
test('empty featured image cannot mask an uploaded category banner', () => {
  const category = { featuredImage: { url: '' }, bannerImage: { url: '/gift-banner.jpg' }, bannerLink: '/shop?category=gifts' };
  assert.equal(resolveShopArtwork([category])?.image.url, '/gift-banner.jpg');
});
test('subcategory artwork keeps its own link and wins over parent artwork', () => {
  const subcategory = { bannerImage: { url: '/sub.jpg' }, bannerLink: '/sub-offer' };
  const parent = { bannerImage: { url: '/parent.jpg' }, bannerLink: '/parent-offer' };
  assert.equal(resolveShopArtwork([subcategory, parent])?.entity.bannerLink, '/sub-offer');
});

test('catalog origin and flavor options include values beyond the loaded page', async () => {
  const { readCatalogFacets } = await import('./filterQuery.ts');
  assert.deepEqual(readCatalogFacets({ countries: ['Nigeria', 'Scotland'], flavors: [{ category: 'fruity' }, { category: 'peaty' }, { category: 'fruity' }] }), {
    originCountry: ['Nigeria', 'Scotland'], flavorCategory: ['fruity', 'peaty'],
  });
});

test('a category featured image alone does not replace the main shop banners', () => {
  assert.equal(resolveShopArtwork([{ featuredImage: { url: '/category-feature.jpg' } }]), null);
});

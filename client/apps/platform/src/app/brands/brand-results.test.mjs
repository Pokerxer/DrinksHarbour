import test from 'node:test';
import assert from 'node:assert/strict';
import { displayableBrands } from './brand-results.ts';
test('card projection preserves card fields and omits unused stories', async () => {
  const { brandCardData } = await import('./brand-results.ts');
  const brand = {
    _id: '1', name: 'House', slug: 'house', productCount: 0,
    countryOfOrigin: 'France', createdAt: '2026-10-01',
    logo: { url: '/logo.png', publicId: 'unused' },
    logoVariants: { white: '/white.png' }, featuredImage: { url: '/fallback.jpg' },
    brandColors: { primary: '#123456' }, shortDescription: 'French house.',
    description: 'Long history. '.repeat(3000), gallery: Array(200).fill('/photo.jpg'),
  };
  const card = brandCardData(brand);
  for (const key of ['_id', 'name', 'slug', 'productCount', 'countryOfOrigin', 'createdAt', 'shortDescription']) {
    assert.equal(card[key], brand[key]);
  }
  assert.equal(card.logo.url, '/logo.png');
  assert.equal(card.logoVariants.white, '/white.png');
  assert.equal(card.featuredImage.url, '/fallback.jpg');
  assert.equal(card.brandColors.primary, '#123456');
  assert.ok(!('gallery' in card) && !('description' in card));
  assert.ok(JSON.stringify(card).length < JSON.stringify(brand).length / 10);
});
test('description-only cards keep a bounded preview and missing counts remain visible', async () => {
  const { brandCardData } = await import('./brand-results.ts');
  const cards = displayableBrands([
    { _id: '1', name: 'House', slug: 'house', description: 'Heritage '.repeat(300) },
    { _id: '2', name: 'New House', slug: 'new-house' },
  ]).map(brandCardData);
  assert.equal(cards.length, 2);
  assert.ok(cards[0].shortDescription.startsWith('Heritage'));
  assert.ok(cards[0].shortDescription.length <= 240);
  assert.equal(cards[1].productCount, undefined);
});
test('Glenfiddich and Laphroaig remain visible with zero or missing cached counts', () => {
  const brands = [
    { name: 'Glenfiddich', slug: 'glenfiddich', productCount: 0 },
    { name: 'Laphroaig', slug: 'laphroaig' },
    { name: 'Other', slug: 'other', productCount: 2 },
  ];
  assert.deepEqual(displayableBrands(brands), brands);
});
test('records without a usable brand destination stay out of the grid', () => {
  assert.deepEqual(displayableBrands([{ name: 'Incomplete' }, { slug: 'incomplete' }]), []);
});

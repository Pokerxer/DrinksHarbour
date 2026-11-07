import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveVariantGallery } from './variant-gallery.ts';

const red = { url: 'https://example.com/red.png' };
const blue = { url: 'https://example.com/blue.png' };
const detail = { url: 'https://example.com/detail.png' };
const listing = { url: 'https://example.com/listing.png' };
const catalog = { url: 'https://example.com/catalog.png' };
const variants = [{ colorName: 'Red', image: red }, { colorName: 'Blue', imageScope: 'color', image: blue }];

test('exact variant photo takes precedence over another size of its color', () => {
  assert.deepEqual(resolveVariantGallery({ colorName: 'Blue', image: detail }, variants, [listing], [catalog]), [detail, listing]);
});

test('sizes share their color photo and the gallery suppresses repeated images', () => {
  assert.deepEqual(resolveVariantGallery({ colorName: ' blue ' }, variants, [blue, listing], [catalog]), [blue, listing]);
});

test('a color without a photo falls back to the selected seller gallery or catalog', () => {
  assert.deepEqual(resolveVariantGallery({ colorName: 'Green' }, variants, [listing], [catalog]), [listing]);
  assert.deepEqual(resolveVariantGallery({ colorName: 'Green' }, variants, [], [catalog]), [catalog]);
});

test('a variant-only photo is not inherited by another size of the same colour', () => {
  assert.deepEqual(resolveVariantGallery({ colorName: 'Red' }, variants, [], [catalog]), [catalog]);
});

test('a shared named option can provide a photo across sizes', () => {
  const scent = { colorName: 'Blue', optionName: 'Citrus', imageScope: 'option', image: detail };
  assert.deepEqual(resolveVariantGallery({ optionName: ' citrus ' }, [scent], [listing], [catalog]), [detail, listing]);
  assert.deepEqual(resolveVariantGallery({ optionName: 'Rose' }, [scent], [], [catalog]), [catalog]);
});

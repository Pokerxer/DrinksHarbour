import { expect, it } from 'vitest';
import { localSizeGuidance, businessSizeOptions, sizePresetMeasurements } from './business-size-options';

const options = [
  { value: '75cl', label: '75cl (Standard)', category: 'Spirits' },
  { value: '50cl', label: '50cl', category: 'Spirits' },
  { value: '70cl', label: '70cl (Standard)', category: 'Spirits' },
  { value: '30ml', label: '30ml E-liquid', category: 'Vapes' },
];

it('offers only manual sizes while the product or its guidance is unavailable', () => {
  expect(businessSizeOptions(options, '', undefined).map(option => option.value)).toEqual(['custom', 'variable']);
  expect(businessSizeOptions(options, 'electronics_laptop', undefined).map(option => option.value)).toContain('ram-128gb');
});

it('adds the standard beverage bottle sizes back for beverage types', () => {
  // Wine-type guidance is the named bottle scale (split/half/magnum…) which
  // dropped the plain metric bottles the form showed before per-type
  // guidance — the baseline union must restore 75cl/70cl/50cl for beverages.
  const codes = businessSizeOptions(options, 'wine', ['split-187ml', 'magnum'], ['beverage']).map(option => option.value);
  expect(codes).toContain('75cl');
  expect(codes).toContain('50cl');
  expect(codes).toContain('70cl');
  // Common bottles lead so the quick-add chips surface 75cl/70cl/50cl again,
  // and each code appears once even when the presets overlap the baseline.
  expect(codes.slice(0, 3)).toEqual(['75cl', '70cl', '50cl']);
  expect(codes.filter(code => code === '75cl')).toHaveLength(1);
  // Type-specific presets that are not baseline bottles stay in the list.
  expect(codes).toContain('split-187ml');
  expect(codes).toContain('magnum');
  // Manual escape hatches stay last.
  expect(codes.slice(-2)).toEqual(['custom', 'variable']);
  // Labels keep the real size-option metadata for beverage codes.
  expect(businessSizeOptions(options, 'wine', ['magnum']).find(option => option.value === '75cl'))
    .toEqual({ value: '75cl', label: '75cl (Standard)', category: 'Spirits' });
});

it('does not add the bottle baseline to non-beverage businesses', () => {
  const codes = businessSizeOptions(options, 'beauty_skincare', ['30ml']).map(option => option.value);
  expect(codes).not.toContain('75cl');
  expect(codes).toContain('30ml');
});

it('uses the selected beauty type’s sizes and neutral labels for shared size codes', () => {
  expect(businessSizeOptions(options, 'beauty_skincare', ['30ml', '50ml', 'custom'])).toEqual([
    { value: '30ml', label: '30 ml', category: 'Volume' },
    { value: '50ml', label: '50 ml', category: 'Volume' },
    { value: 'custom', label: 'custom', category: 'Other sizes' },
    { value: 'variable', label: 'variable', category: 'Other sizes' },
  ]);
});

it('defaults measured presets to a 6-pack, and pack codes carry their own counts', () => {
  expect(sizePresetMeasurements('30ml')).toMatchObject({ volumeMl: 30, unitsPerPack: 6, packaging: 'pack-6' });
  expect(sizePresetMeasurements('75cl')).toMatchObject({ volumeMl: 750, unitsPerPack: 6, packaging: 'pack-6' });
  expect(sizePresetMeasurements('pack-12')).toMatchObject({ unitType: 'count_pack', unitsPerPack: 12, packaging: 'pack-12' });
  expect(sizePresetMeasurements('case-24')).toMatchObject({ unitType: 'count_case', unitsPerPack: 24, packaging: 'case-24' });
});


it('shows Beauty presets immediately for a Beauty tenant without a selected product', () => {
  const codes = businessSizeOptions(options, '', undefined, ['beauty']).map(option => option.value);
  expect(codes).toContain('30ml');
  expect(codes).toContain('set-2');
  expect(codes).not.toContain('75cl');
  expect(localSizeGuidance('', ['beauty', 'beverage'])).toEqual([]);
});

it('keeps offline presets aligned with every server product type', async () => {
  const { createRequire } = await import('node:module');
  const load = createRequire(import.meta.url);
  const { getSizesForType } = load(process.cwd() + '/../../../server/constants/productTypes');
  const { PRODUCT_TYPE_VALUES } = load(process.cwd() + '/../../../server/constants/productTypes');
  for (const type of PRODUCT_TYPE_VALUES) {
    expect(localSizeGuidance(type)).toEqual(getSizesForType(type));
  }
});

it('allows multiple individually named custom sizes without reusing a saved code', async () => {
  const { availableCustomSize } = await import('./business-size-options');
  expect(availableCustomSize([])).toBe('custom');
  expect(availableCustomSize(['custom', 'custom-2', '30ml'])).toBe('custom-3');
});

it('keeps the standard bottles in the real size-option pool for beverage types', async () => {
  const { SIZE_OPTIONS } = await import('./sizes');
  const codes = (type: string, presets: readonly string[]) =>
    businessSizeOptions(SIZE_OPTIONS, type, presets).map(option => option.value);
  const wine = codes('wine', ['split-187ml', 'standard-750ml', 'magnum']);
  // The named wine scale must not hide the plain metric bottles again.
  expect(wine).toContain('75cl');
  expect(wine).toContain('70cl');
  expect(wine).toContain('50cl');
  expect(wine.slice(0, 3)).toEqual(['75cl', '70cl', '50cl']);
  // Plenitude: the pre-restriction picker showed the whole static pool —
  // every pool code (glassware, gift sets, single serves, all bottle
  // families…) stays available to a beverage listing.
  const pool = [...new Set(SIZE_OPTIONS.map(option => option.value))];
  for (const code of pool) expect(wine).toContain(code);
  // Per-type presets bring their type-only extras on top of the pool.
  expect(wine).toContain('magnum');
  const beer = codes('beer', ['25cl', '33cl', '35cl', '37.5cl', '50cl', 'keg-20L']);
  expect(beer).toContain('75cl');
  expect(beer).toContain('bottle-330ml');
  expect(beer).toContain('keg-20L');
  // 70cl is a spirits standard — a whisky listing must still offer it.
  expect(codes('whiskey', ['50cl', '70cl', '1L'])).toContain('70cl');
});

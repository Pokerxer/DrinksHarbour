import { expect, it } from 'vitest';
import { localSizeGuidance, businessSizeOptions, sizePresetMeasurements } from './business-size-options';

const options = [
  { value: '75cl', label: 'Wine bottle', category: 'Wine' },
  { value: '30ml', label: '30ml E-liquid', category: 'Vapes' },
];

it('offers only manual sizes while the product or its guidance is unavailable', () => {
  expect(businessSizeOptions(options, '', undefined).map(option => option.value)).toEqual(['custom', 'variable']);
  expect(businessSizeOptions(options, 'electronics_laptop', undefined).map(option => option.value)).toContain('ram-128gb');
});

it('uses the selected beauty type’s sizes and neutral labels for shared size codes', () => {
  expect(businessSizeOptions(options, 'beauty_skincare', ['30ml', '50ml', 'custom'])).toEqual([
    { value: '30ml', label: '30 ml', category: 'Volume' },
    { value: '50ml', label: '50 ml', category: 'Volume' },
    { value: 'custom', label: 'custom', category: 'Other sizes' },
    { value: 'variable', label: 'variable', category: 'Other sizes' },
  ]);
});

it('converts size presets without adding arbitrary packs', () => {
  expect(sizePresetMeasurements('30ml')).toMatchObject({ volumeMl: 30, unitsPerPack: 1 });
  expect(sizePresetMeasurements('75cl')).toMatchObject({ volumeMl: 750 });
  expect(sizePresetMeasurements('case-24')).toMatchObject({ unitType: 'count_case', unitsPerPack: 24 });
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

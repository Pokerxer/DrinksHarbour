import { describe, expect, it } from 'vitest';
import {
  retailProductTypeOptions,
  retailProductTypeValues,
  sizeOptionsForGuidance,
  SIZE_GROUPS,
} from './retail-product-types';
import { productTypes } from '@/app/shared/ecommerce/product/create-edit/form-utils';

// Electronics guidance test needs a representative option pool (screen/battery
// pools are COMPLETE so the tv/power guidance filters return their full sets).
const options = [
  { value: '75cl', label: '75cl', category: 'Wine' },
  { value: 'storage-16gb', label: '16GB Storage', category: 'Device Storage' },
  { value: 'storage-4tb', label: '4TB Storage', category: 'Device Storage' },
  { value: 'screen-24', label: '24-inch', category: 'Screen Size' },
  { value: 'screen-32', label: '32-inch', category: 'Screen Size' },
  { value: 'screen-43', label: '43-inch', category: 'Screen Size' },
  { value: 'screen-50', label: '50-inch', category: 'Screen Size' },
  { value: 'screen-55', label: '55-inch', category: 'Screen Size' },
  { value: 'screen-65', label: '65-inch', category: 'Screen Size' },
  { value: 'screen-75', label: '75-inch', category: 'Screen Size' },
  { value: 'screen-85', label: '85-inch', category: 'Screen Size' },
  { value: 'ram-16gb', label: '16GB RAM', category: 'RAM' },
  { value: 'battery-5000mah', label: '5,000mAh', category: 'Battery Capacity' },
  { value: 'battery-10000mah', label: '10,000mAh', category: 'Battery Capacity' },
  { value: 'battery-20000mah', label: '20,000mAh', category: 'Battery Capacity' },
  { value: 'battery-26800mah', label: '26,800mAh', category: 'Battery Capacity' },
];
import { productTypes as tenantTypes } from '@/app/shared/ecommerce/sub-product/create-edit/form-utils';
import { productFormSchema } from '@/validators/create-product.schema';
import {
  NON_BEVERAGE_PRODUCT_TYPES,
  isBeverageProductType,
} from './product-types';

const countByGroup = (group: string) =>
  retailProductTypeOptions.filter((option) => option.category === group).length;

describe('retail vertical product types (server retailTypes mirror)', () => {
  it('registers the four server groups with exact counts 14/11/7/11', () => {
    expect(countByGroup('Electronics')).toBe(14);
    expect(countByGroup('Fashion')).toBe(11);
    expect(countByGroup('Beauty')).toBe(7);
    expect(countByGroup('Home')).toBe(11);
    expect(retailProductTypeValues).toHaveLength(43);
  });

  it('offers and accepts every retail value in both product flows', () => {
    for (const value of retailProductTypeValues) {
      expect(productTypes.some((option) => option.value === value)).toBe(true);
      expect(tenantTypes.some((option) => option.value === value)).toBe(true);
      expect(productFormSchema.shape.type.safeParse(value).success).toBe(true);
    }
  });

  it('mirrors sync: every retail value is a known non-beverage type and vice versa', () => {
    for (const value of retailProductTypeValues) {
      expect(NON_BEVERAGE_PRODUCT_TYPES.has(value)).toBe(true);
      expect(isBeverageProductType(value)).toBe(false);
    }
    // Reverse direction: every type option labeled with a retail group maps
    // back to the canonical mirror list.
    const retailOptions = productTypes.filter((option) =>
      ['Electronics', 'Fashion', 'Beauty', 'Home'].includes(option.category)
    );
    expect(retailOptions).toHaveLength(43);
    for (const option of retailOptions) {
      expect(retailProductTypeValues).toContain(option.value);
    }
  });

  it('keeps beverages beverage', () => {
    expect(isBeverageProductType('wine')).toBe(true);
    expect(isBeverageProductType('coffee_beans')).toBe(true);
  });
});

// ── Industry-scoped size guidance (2026-11-03) ──────────────────────────────
describe('sizeOptionsForGuidance', () => {
  const options = [
    { value: '75cl', label: '75cl (Standard)', category: 'Wine' },
    { value: 'm', label: 'M', category: 'Apparel' },
    { value: 'us-8', label: 'US 8', category: 'Numeric (US)' },
    { value: 'w32', label: 'W32', category: 'Waist' },
    { value: 'kids-6-7', label: 'Kids 6-7', category: 'Kids Age' },
    { value: 'eu-42', label: 'EU 42', category: 'Shoes' },
  ];

  it('null/absent guidance returns the FULL list unchanged (legacy fallback)', () => {
    expect(sizeOptionsForGuidance(options, null)).toEqual(options);
    expect(sizeOptionsForGuidance(options, undefined)).toEqual(options);
    expect(sizeOptionsForGuidance(options, [])).toEqual(options);
  });

  it('filters to the server guidance for a fashion product', () => {
    const guidance = ['m', 'us-8', 'w32', 'kids-6-7', 'eu-42', 'custom', 'variable'];
    const filtered = sizeOptionsForGuidance(options, guidance);
    expect(filtered.map((o) => o.value)).toEqual(['m', 'us-8', 'w32', 'kids-6-7', 'eu-42']);
    // Beverage sizes (75cl) are gone — a fashion business never sees them.
    expect(filtered.some((o) => o.value === '75cl')).toBe(false);
  });

  it('unknown guidance values never break the picker (drop-only semantics)', () => {
    const filtered = sizeOptionsForGuidance(options, ['nonexistent-size']);
    expect(filtered).toEqual([]);
  });
});

// ── Electronics sizing systems (2026-11-03) ─────────────────────────────────
describe('electronics size guidance mirror', () => {
  it('SIZE_GROUPS carries the screen/ram/battery groups in the server canon', () => {
    expect(SIZE_GROUPS.screen.values).toEqual(['screen-24', 'screen-32', 'screen-43', 'screen-50', 'screen-55', 'screen-65', 'screen-75', 'screen-85']);
    expect(SIZE_GROUPS.ram.values).toEqual(['ram-4gb', 'ram-8gb', 'ram-16gb', 'ram-32gb', 'ram-64gb']);
    expect(SIZE_GROUPS.battery.values).toEqual(['battery-5000mah', 'battery-10000mah', 'battery-20000mah', 'battery-26800mah']);
    expect(SIZE_GROUPS.storage.values).toContain('storage-4tb');
  });

  it('guidance filter separates TVs, portable screens and power capacity', async () => {
    // Live parity: the server's getSizesForType is the authority.
    const { createRequire } = await import('node:module');
    const nodeRequire = createRequire(import.meta.url);
    const server = nodeRequire('../../../../../server/constants/productTypes.js');
    const tvOptions = sizeOptionsForGuidance(options, server.getSizesForType('electronics_tv_display'));
    expect(tvOptions.map((o) => o.value)).toEqual(SIZE_GROUPS.screen.values);
    const powerOptions = sizeOptionsForGuidance(options, server.getSizesForType('electronics_power'));
    expect(powerOptions.map((o) => o.value)).toEqual(SIZE_GROUPS.battery.values);

    const screens = [...SIZE_GROUPS.screen.values, ...SIZE_GROUPS.portableScreen.values]
      .map((value) => ({ value }));
    for (const [type, expected] of [
      ['electronics_laptop', server.STANDARD_SIZES.LAPTOP_SCREEN_INCH],
      ['electronics_tablet', server.STANDARD_SIZES.TABLET_SCREEN_INCH],
    ]) {
      const matches = sizeOptionsForGuidance(screens, server.getSizesForType(type));
      expect(matches.map(({ value }) => value)).toEqual(expected);
    }
  });
});

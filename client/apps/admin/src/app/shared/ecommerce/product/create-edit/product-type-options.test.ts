// Unit tests for the grouped product-type option builder used by the product
// and sub-product identification types. UI-free: no rizzui Select mounting.
import { describe, expect, it } from 'vitest';
import {
  buildProductTypeOptions,
  PRODUCT_TYPE_HEADING_VALUE_PREFIX,
} from './product-type-options';

const TYPES = [
  { value: 'wine', label: 'Wine', category: 'Alcoholic' },
  { value: 'beer', label: 'Beer', category: 'Alcoholic' },
  { value: 'juice', label: 'Juice', category: 'Non-Alcoholic' },
  {
    value: 'fashion_dress',
    label: 'Dress',
    category: 'Fashion',
  },
  {
    value: 'home_decor',
    label: 'Home Decor',
    category: 'Home',
  },
] as const;

describe('buildProductTypeOptions', () => {
  it('inserts a disabled heading before each new category in data order', () => {
    const options = buildProductTypeOptions(TYPES);
    const headings = options.filter((o) => o.isHeading);
    expect(headings.map((h) => h.label)).toEqual([
      'Alcoholic',
      'Non-Alcoholic',
      'Fashion',
      'Home',
    ]);
    for (const heading of headings) {
      expect(heading.disabled).toBe(true);
      expect(heading.value.startsWith(PRODUCT_TYPE_HEADING_VALUE_PREFIX)).toBe(
        true
      );
    }
  });

  it('keeps real options selectable and copy-equal to the source option', () => {
    const options = buildProductTypeOptions(TYPES);
    const wine = options.find((o) => o.value === 'wine');
    expect(wine).toEqual({ value: 'wine', label: 'Wine', category: 'Alcoholic' });
    expect(wine!.disabled).toBeUndefined();
    expect(wine!.isHeading).toBeUndefined();
  });

  it('does not repeat a heading when categories run consecutively', () => {
    const options = buildProductTypeOptions([
      { value: 'wine', label: 'Wine', category: 'Alcoholic' },
      {
        value: 'rice_wine',
        label: 'Rice Wine',
        category: 'Alcoholic',
      },
    ]);
    expect(options.filter((o) => o.isHeading)).toHaveLength(1);
  });

  it('groups nonconsecutive categories under one heading with unique keys', () => {
    const options = buildProductTypeOptions([
      TYPES[2], TYPES[0],
      { value: 'tea', label: 'Tea', category: 'Non-Alcoholic' },
    ]);
    const keys = options.map(option => option.value);
    expect(keys).toEqual(['__group::Non-Alcoholic', 'juice', 'tea', '__group::Alcoholic', 'wine']);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('search mode returns flat matched results with NO headings', () => {
    const options = buildProductTypeOptions(TYPES, 'dress');
    expect(options.some((o) => o.isHeading)).toBe(false);
    expect(options.map((o) => o.value)).toEqual(['fashion_dress']);
  });

  it('search matches the group name too, and never blocks the type value', () => {
    const byCategory = buildProductTypeOptions(TYPES, 'fashion');
    expect(byCategory.map((o) => o.value)).toEqual(['fashion_dress']);
    const byValue = buildProductTypeOptions(TYPES, 'home_decor');
    expect(byValue.map((o) => o.value)).toEqual(['home_decor']);
    const byLabel = buildProductTypeOptions(TYPES, 'beer');
    expect(byLabel.map((o) => o.value)).toEqual(['beer']);
  });

  it('returns no options when the search matches nothing', () => {
    expect(buildProductTypeOptions(TYPES, 'software')).toEqual([]);
  });

  it('whitespace search behaves as browse mode', () => {
    const options = buildProductTypeOptions(TYPES, '   ');
    expect(options.some((o) => o.isHeading)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { SIZE_OPTIONS } from './sizes';
import { SIZE_GROUPS } from '@/utils/retail-product-types';
import {
  normalizeColorHexInput,
  isCompleteColorHex,
  COLOR_NAME_MAX_LENGTH,
} from './color-variant';
import { sizeOptionSchema } from '@/validators/sub-product.schema';

const valuesByCategory = (category: string) =>
  SIZE_OPTIONS.filter((option) => option.category === category).map(
    (option) => option.value
  );

describe('size option groups for the retail verticals', () => {
  it('includes the kilogram variants used by Food Service and Hospitality guidance', () => {
    expect(valuesByCategory('Procurement Weight')).toEqual(['kg-0.5', 'kg-1', 'kg-2']);
  });

  it('lists the canonical apparel, shoes and storage groups', () => {
    expect(valuesByCategory('Apparel')).toEqual([...SIZE_GROUPS.apparel.values]);
    expect(valuesByCategory('Shoes')).toEqual([...SIZE_GROUPS.shoes.values]);
    expect(valuesByCategory('Device Storage')).toEqual([
      ...SIZE_GROUPS.storage.values,
    ]);
    expect(valuesByCategory('Apparel')).toHaveLength(11);
    expect(valuesByCategory('Shoes')).toHaveLength(31);
    // 2026-11-03: storage-4tb joined the electronics sizing systems.
    expect(valuesByCategory('Device Storage')).toHaveLength(9);
  });

  it('matches the Size enum contract incl. 6xl and US-M 8.5', () => {
    expect(valuesByCategory('Apparel')).toContain('6xl');
    expect(valuesByCategory('Apparel')).toContain('one_size');
    expect(valuesByCategory('Shoes')).toContain('us-m-8.5');
    expect(valuesByCategory('Shoes')).toContain('eu-47');
    expect(valuesByCategory('Device Storage')).toContain('storage-2tb');
    expect(valuesByCategory('Device Storage')).toContain('storage-4tb');
  });

  it('accepts and normalizes the size row color variant fields', () => {
    // colorName verbatim up to 60 chars; '' dropped
    const parsed = sizeOptionSchema.parse({
      size: 'm',
      colorName: 'Midnight Navy',
      colorHexCode: '#1f2a44',
    });
    expect(parsed.colorName).toBe('Midnight Navy');
    expect(parsed.colorHexCode).toBe('#1F2A44');

    const empty = sizeOptionSchema.parse({
      size: 'm',
      colorName: '   ',
      colorHexCode: '#abc',
    });
    expect(empty.colorName).toBeUndefined();
    expect(empty.colorHexCode).toBeUndefined();
    expect(COLOR_NAME_MAX_LENGTH).toBe(60);
  });

  it('normalizes swatch typing leniently but validates completions', () => {
    expect(normalizeColorHexInput('1f2a4')).toBe('#1F2A4');
    expect(normalizeColorHexInput('zz #1f2a4x')).toBe('#1F2A4');
    expect(isCompleteColorHex('#1F2A44')).toBe(true);
    expect(isCompleteColorHex('#1F2A4')).toBe(false);
  });
});

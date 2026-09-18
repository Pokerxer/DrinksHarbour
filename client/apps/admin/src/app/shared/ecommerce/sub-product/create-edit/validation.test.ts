import { describe, it, expect } from 'vitest';
import { validateSizeVariants } from './validation';

describe('validateSizeVariants', () => {
  it('returns no errors when selling without size variants', () => {
    expect(validateSizeVariants([{ size: '' }], true)).toEqual([]);
    expect(
      validateSizeVariants([{ size: '50cl' }, { size: '50cl' }], true)
    ).toEqual([]);
    expect(validateSizeVariants(undefined, true)).toEqual([]);
  });

  it('flags missing size selections when selling with variants', () => {
    expect(
      validateSizeVariants([{ size: '50cl' }, { size: '' }, { size: null }], false)
    ).toEqual(['2 size variant(s) are missing a size selection']);
  });

  it('flags duplicate size values when selling with variants', () => {
    expect(
      validateSizeVariants([{ size: ' 50CL ' }, { size: '50cl' }], false)
    ).toEqual([
      'Duplicate size value " 50CL ". Each size value can only appear once per product.',
    ]);
  });

  it('reports missing before duplicates, preserving guard order', () => {
    const errs = validateSizeVariants(
      [{ size: '' }, { size: '70cl' }, { size: '70cl' }, { size: '1L' }],
      false
    );
    expect(errs).toHaveLength(2);
    expect(errs[0]).toMatch(/missing a size selection/);
    expect(errs[1]).toMatch(/Duplicate size value "70cl"/);
  });

  it('accepts clean size rows', () => {
    expect(validateSizeVariants([{ size: '50cl' }, { size: '1L' }], false)).toEqual([]);
  });

  it('treats undefined sizes as empty when selling with variants', () => {
    expect(validateSizeVariants(undefined, false)).toEqual([]);
  });
});
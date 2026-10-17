import { describe, expect, it } from 'vitest';
import { isBeverageProductType } from './product-types';
import { productFormSchema } from '@/validators/create-product.schema';
import { productTypes, standardSizes } from '@/app/shared/ecommerce/product/create-edit/form-utils';

describe('vape and exact snack weight admin support', () => {
  it('keeps drink-only fields hidden for vape products', () => {
    expect(isBeverageProductType('vape')).toBe(false);
    expect(isBeverageProductType('wine')).toBe(true);
  });
  it('accepts the vape type in the product form', () => {
    expect(productFormSchema.shape.type.safeParse('vape').success).toBe(true);
    expect(productTypes.some(option => option.value === 'vape')).toBe(true);
  });
  it('offers exact 240g instead of rounding it to 250g', () => {
    expect(standardSizes.some(option => option.value === '240g' && option.volume === 0)).toBe(true);
  });
  it('accepts nuts as the precise cashew classification', () => {
    expect(productFormSchema.shape.type.safeParse('nuts').success).toBe(true);
    expect(productTypes.some(option => option.value === 'nuts')).toBe(true);
    expect(isBeverageProductType('nuts')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { resolveSubProductPricing } from './sub-product-pricing';
import { subProductFormSchema } from '@/validators/sub-product.schema';
import {
  transformFormData,
  validateRequiredFields,
} from './transformers/subProduct.transformer';

const variantProduct = {
  subProductData: {
    product: '507f1f77bcf86cd799439011',
    sku: 'TEST-SIZES',
    costPrice: 0,
    baseSellingPrice: 0,
    sellWithoutSizeVariants: false,
    sizes: [
      { size: '50cl', costPrice: 1000, basePrice: 1500 },
      { size: '1L', costPrice: 2000, basePrice: 3000, isDefault: true },
    ],
  },
};

describe('variant pricing with optional base defaults', () => {
  it('handles numeric input strings without treating zero as an explicit default', () => {
    expect(
      resolveSubProductPricing({
        ...variantProduct.subProductData,
        costPrice: '0',
        baseSellingPrice: '0',
      })
    ).toEqual({ costPrice: 2000, baseSellingPrice: 3000 });
  });
  it('validates and saves using the default size when base defaults are blank', () => {
    expect(subProductFormSchema.safeParse(variantProduct).success).toBe(true);
    expect(validateRequiredFields(variantProduct)).toEqual([]);
    const payload = transformFormData(variantProduct);
    expect(payload.costPrice).toBe(2000);
    expect(payload.baseSellingPrice).toBe(3000);
    expect(payload.sizes.map((size) => size.basePrice)).toEqual([1500, 3000]);
    expect(variantProduct.subProductData.costPrice).toBe(0);
  });

  it('uses the first selected size when no default is marked', () => {
    const data = {
      subProductData: {
        ...variantProduct.subProductData,
        sizes: [
          { size: '', costPrice: 99 },
          { size: '50cl', costPrice: 1000, basePrice: 1500 },
        ],
      },
    };
    expect(transformFormData(data)).toMatchObject({
      costPrice: 1000,
      baseSellingPrice: 1500,
    });
  });

  it('preserves explicitly configured base defaults', () => {
    const data = {
      subProductData: {
        ...variantProduct.subProductData,
        costPrice: 500,
        baseSellingPrice: 750,
      },
    };
    expect(transformFormData(data)).toMatchObject({
      costPrice: 500,
      baseSellingPrice: 750,
    });
  });

  it('requires a base cost for single-item mode despite retained hidden sizes', () => {
    const data = {
      subProductData: {
        ...variantProduct.subProductData,
        sellWithoutSizeVariants: true,
      },
    };
    expect(subProductFormSchema.safeParse(data).success).toBe(false);
    expect(validateRequiredFields(data)).toContain('Cost Price');
    expect(transformFormData(data).costPrice).toBe(0);
  });
});

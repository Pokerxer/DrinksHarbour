import { describe, expect, it } from 'vitest';
import {
  resolveSubProductPricing,
  resolveSizePrices,
  resolveToolbarPrice,
} from './sub-product-pricing';
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

describe('resolveSizePrices — card/toolbar price from the size rows', () => {
  const serverSizes = (prices: Array<Record<string, unknown>>) =>
    prices.map((price, index) => ({ _id: `s${index}`, ...price }));

  it('returns the min–max range across the sizes a listing carries', () => {
    expect(
      resolveSizePrices(serverSizes([{ sellingPrice: 3000 }, { sellingPrice: 1500 }]), 10000)
    ).toEqual({ price: 1500, priceMax: 3000 });
  });

  it('drops the range when every size prices the same', () => {
    expect(
      resolveSizePrices(serverSizes([{ sellingPrice: 2000 }, { sellingPrice: '2000' }]), 0)
    ).toEqual({ price: 2000 });
  });

  it('uses an active size sale over its regular selling price', () => {
    expect(
      resolveSizePrices(
        serverSizes([
          { sellingPrice: 3000, salePrice: 1500, isOnSale: true },
          { sellingPrice: 500 },
        ]),
        0
      )
    ).toEqual({ price: 500, priceMax: 1500 });
  });

  it('ignores a sale price when the row is not flagged isOnSale', () => {
    expect(
      resolveSizePrices(
        serverSizes([{ sellingPrice: 3000, salePrice: 5, isOnSale: false }]),
        0
      )
    ).toEqual({ price: 3000 });
  });

  it('falls back to the listing base price when no size carries a price', () => {
    expect(
      resolveSizePrices(serverSizes([{ sellingPrice: 0 }, {}]), 7000)
    ).toEqual({ price: 7000 });
  });

  it('reads form rows through their basePrice field', () => {
    expect(
      resolveSizePrices([{ basePrice: 1000, isOnSale: false }, { basePrice: 2500 }], 0)
    ).toEqual({ price: 1000, priceMax: 2500 });
  });

  it('returns the fallback for empty or missing size arrays', () => {
    expect(resolveSizePrices([], 900)).toEqual({ price: 900 });
  });
});

it('shows the base price when single-item mode retains hidden size rows', () => {
  expect(
    resolveToolbarPrice({
      ...variantProduct.subProductData,
      baseSellingPrice: 750,
      sellWithoutSizeVariants: true,
    })
  ).toEqual({ price: 750 });
});

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

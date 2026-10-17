import { expect, test } from 'vitest';
import {
  effectiveSizelessPrice,
  sizelessSelection,
  sizeSelection,
  type CatalogProduct,
} from './sales-catalog-pricing';
import { mapCatalogueProduct } from './sales-catalog-data';
const product: CatalogProduct = {
  _id: 'sp',
  productId: 'central',
  name: 'Wine',
  sku: 'SKU',
  baseSellingPrice: 1000,
  costPrice: 300,
  taxRate: 7.5,
  sellWithoutSizeVariants: true,
  sizes: [],
  availableStock: 7,
};
const pricelist = {
  rules: [{ priceType: 'fixed', fixedPrice: 650, minQuantity: 0 }],
};

test('sizeless display and add selection use the same active pricelist', () => {
  expect(effectiveSizelessPrice(product, pricelist)).toBe(650);
  expect(sizelessSelection(product, pricelist)).toMatchObject({
    sellingPrice: 650,
    originalPrice: 1000,
    costPrice: 300,
    availableStock: 7,
  });
});

test('variant selection preserves pack, identity, stock and raw price alongside effective price', () => {
  expect(
    sizeSelection(
      product,
      {
        size: 'size',
        displayName: '75cl',
        sellingPrice: 1200,
        costPrice: 400,
        unitsPerPack: 12,
        availableStock: 5,
      },
      pricelist
    )
  ).toMatchObject({
    sizeId: 'size',
    sizeName: '75cl',
    sellingPrice: 650,
    originalPrice: 1200,
    unitsPerPack: 12,
    availableStock: 5,
    costPrice: 400,
  });
});

test('compact data mapping preserves zero availability, pack size, image override and tax', () => {
  const mapped = mapCatalogueProduct({
    _id: 'sp',
    product: {
      _id: 'central',
      name: 'Wine',
      images: [{ url: 'original.jpg' }],
    },
    imagesOverride: [
      { url: 'https://res.cloudinary.com/shop/image/upload/override.jpg' },
    ],
    availableStock: 0,
    totalStock: 100,
    taxRate: 7.5,
    sizes: [
      {
        _id: 'size',
        size: '75cl',
        unitsPerPack: 24,
        availableStock: 0,
        stock: 9,
      },
    ],
  });
  expect(mapped).toMatchObject({
    availableStock: 0,
    taxRate: 7.5,
    sizes: [{ size: 'size', unitsPerPack: 24, availableStock: 0 }],
  });
  expect(mapped.image).toContain(
    '/c_fit,w_480,h_480,q_auto,f_auto/override.jpg'
  );
});

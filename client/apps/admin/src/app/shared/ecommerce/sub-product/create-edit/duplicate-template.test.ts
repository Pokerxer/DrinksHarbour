import { describe, expect, it } from 'vitest';
import { buildDuplicateTemplate } from './duplicate-template';

const product = {
  _id: 'parent-id', name: 'Original IPA', type: 'beer', subType: 'ipa',
  style: 'american_ipa', brand: { _id: 'brand-id', name: 'Brand' },
  category: { _id: 'category-id' }, abv: 6.5, volumeMl: 330,
  description: 'Citrus beer', isAlcoholic: true, barcode: 'existing-barcode',
  images: [{ url: 'https://example.com/bottle.png', alt: 'Bottle' }],
};
const source = {
  _id: 'source-id', product, tenant: { _id: 'tenant-id' }, sku: 'OLD-SKU',
  baseSellingPrice: 5000, costPrice: 3000, totalStock: 40, reservedStock: 3,
  totalSold: 12, status: 'active', isPublished: true, isOnSale: true,
  flashSale: { isActive: true },
  sizes: [{ _id: 'size-id', size: '33cl', sellingPrice: 5000, costPrice: 3000,
    stock: 40, stockQuantity: 40, reservedStock: 3, sku: 'SIZE-SKU', barcode: 'SIZE-BARCODE',
    isDefault: true, isOnSale: true }],
};

describe('editable duplicate template', () => {
  it('copies catalog details and selling configuration into new-product mode', () => {
    const data = buildDuplicateTemplate(source, product).subProductData;
    expect(data.createNewProduct).toBe(true);
    expect(data.product).toBe('');
    expect(data.newProductData).toMatchObject({ name: 'Original IPA', type: 'beer',
      subType: 'ipa', style: 'american_ipa', brand: 'brand-id', category: 'category-id', abv: 6.5 });
    expect(data.baseSellingPrice).toBe(5000);
    expect(data.costPrice).toBe(3000);
    expect(data.sizes[0]).toMatchObject({ size: '33cl', basePrice: 5000, costPrice: 3000 });
    expect(data.tenant).toBe('tenant-id');
  });
  it('does not reuse identities, stock, sales history or publication', () => {
    const data = buildDuplicateTemplate(source, product).subProductData;
    expect(data._id).toBeUndefined();
    expect(data.id).toBeUndefined();
    expect(data.sku).toBe('');
    expect(data.newProductData?.barcode).toBe('');
    expect(data.totalStock).toBe(0);
    expect(data.reservedStock).toBe(0);
    expect(data).not.toHaveProperty('totalSold');
    expect(data.status).toBe('draft');
    expect(data.isPublished).toBe(false);
    expect(data.isOnSale).toBe(false);
    expect(data.flashSale?.isActive).not.toBe(true);
    expect(data.sizes[0]).toMatchObject({ stock: 0, reservedStock: 0, availableStock: 0, sku: '', barcode: '', isOnSale: false });
    expect(data.sizes[0]._id).toBeUndefined();
  });
  it('does not mutate the source when the copy is edited', () => {
    const before = structuredClone(source);
    const data = buildDuplicateTemplate(source, product).subProductData;
    data.sizes[0].costPrice = 1;
    if (data.newProductData) data.newProductData.name = 'Different beer';
    expect(source).toEqual(before);
  });
});

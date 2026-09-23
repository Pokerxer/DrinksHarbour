import { subProductFormSchema, type SubProductInput } from '@/validators/sub-product.schema';
import { transformBackendToForm } from '@/utils/transformers/subProduct.transformer';

function pick(source: object, keys: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(source).filter(([key]) => keys.includes(key)));
}

export function relationId(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && '_id' in value && typeof value._id === 'string') {
    return value._id;
  }
  return '';
}

/** Copy configuration only: never identities, stock, history or active promotions. */
export function buildDuplicateTemplate(
  source: Record<string, unknown>,
  product: Record<string, unknown>
): SubProductInput {
  const form = transformBackendToForm(source).subProductData;
  return subProductFormSchema.parse({
    subProductData: {
      ...pick(form, [
        'baseSellingPrice', 'costPrice', 'currency', 'taxRate', 'markupPercentage',
        'roundUp', 'pricingStrategy', 'minPrice', 'maxPrice',
        'shortDescriptionOverride', 'descriptionOverride', 'customKeywords',
        'sellWithoutSizeVariants', 'lowStockThreshold', 'reorderPoint', 'reorderQuantity',
        'tracking', 'valuation', 'routes', 'vendor', 'leadTimeDays',
        'minimumOrderQuantity', 'shipping',
      ]),
      tenant: relationId(source.tenant),
      product: '',
      sku: '',
      createNewProduct: true,
      newProductData: {
        ...pick(product, [
          'name', 'type', 'subType', 'style', 'volumeMl', 'abv', 'proof',
          'originCountry', 'region', 'producer', 'description', 'shortDescription',
          'isAlcoholic', 'vintage',
        ]),
        brand: relationId(product.brand),
        category: relationId(product.category),
        subCategory: relationId(product.subCategory),
        barcode: '',
      },
      imagesOverride: form.imagesOverride?.length ? form.imagesOverride : product.images || [],
      status: 'draft',
      isPublished: false,
      stockStatus: 'out_of_stock',
      sizes: (form.sizes || []).map((size) => ({
        ...pick(size, [
          'size', 'displayName', 'sizeCategory', 'unitType', 'volumeMl', 'weightGrams',
          'servingsPerUnit', 'unitsPerPack', 'basePrice', 'compareAtPrice', 'costPrice',
          'wholesalePrice', 'currency', 'markupPercentage', 'roundUp', 'packaging',
          'lowStockThreshold', 'reorderPoint', 'reorderQuantity', 'minOrderQuantity',
          'maxOrderQuantity', 'orderIncrement', 'requiresAgeVerification', 'isDefault',
        ]),
        sku: '', barcode: '', availability: 'out_of_stock',
      })),
    },
  });
}

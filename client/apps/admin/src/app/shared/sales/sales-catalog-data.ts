import type {
  CatalogProduct,
  CatalogSalesPricing,
} from './sales-catalog-pricing';
import type { POSBundleDeal } from '@/app/shared/point-of-sale/types';

export type Option = { id: string; name: string };
export type CatalogueFilters = {
  categories: string[];
  brands: string[];
  types: string[];
  inStock: boolean;
  sort: 'name' | 'priceAsc' | 'priceDesc' | 'stock';
};
export const emptyFilters: CatalogueFilters = {
  categories: [],
  brands: [],
  types: [],
  inStock: false,
  sort: 'name',
};
export type CataloguePage = {
  products: CatalogProduct[];
  pagination: {
    page: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  facets?: { categories: Option[]; brands: Option[]; types: Option[] };
};
type RawProduct = {
  salesPricing?: CatalogSalesPricing;
  _id: string;
  sku?: string;
  baseSellingPrice?: number;
  costPrice?: number;
  taxRate?: number;
  availableStock?: number;
  totalStock?: number;
  sellWithoutSizeVariants?: boolean;
  bundleDeals?: POSBundleDeal[];
  imagesOverride?: { url?: string }[];
  product: {
    _id: string;
    name: string;
    type?: string;
    isAlcoholic?: boolean;
    abv?: number;
    brand?: { _id: string; name: string };
    category?: { _id: string; name: string };
    images?: { url?: string }[];
  };
  sizes?: {
    salesPricing?: CatalogSalesPricing;
    _id: string;
    size: string;
    displayName?: string;
    sku?: string;
    sellingPrice?: number;
    costPrice?: number;
    wholesalePrice?: number;
    availableStock?: number;
    stock?: number;
    unitsPerPack?: number;
  }[];
};

function thumbnail(url?: string) {
  if (!url) return undefined;
  return url.includes('res.cloudinary.com')
    ? url.replace('/upload/', '/upload/c_fit,w_480,h_480,q_auto,f_auto/')
    : url;
}

export function mapCatalogueProduct(sp: RawProduct): CatalogProduct {
  return {
    _id: sp._id,
    salesPricing: sp.salesPricing,
    productId: sp.product._id,
    name: sp.product.name,
    sku: sp.sku || '',
    image: thumbnail(
      sp.imagesOverride?.[0]?.url || sp.product.images?.[0]?.url
    ),
    type: sp.product.type,
    brand: sp.product.brand?.name,
    brandId: sp.product.brand?._id,
    category: sp.product.category?.name,
    categoryId: sp.product.category?._id,
    isAlcoholic: sp.product.isAlcoholic,
    abv: sp.product.abv,
    baseSellingPrice: sp.baseSellingPrice ?? 0,
    costPrice: sp.costPrice ?? 0,
    taxRate: sp.taxRate ?? 0,
    totalStock: sp.totalStock,
    availableStock: sp.availableStock,
    sellWithoutSizeVariants: sp.sellWithoutSizeVariants ?? false,
    bundleDeals: sp.bundleDeals ?? [],
    sizes: (sp.sizes || []).map((s) => ({
      size: s._id,
      salesPricing: s.salesPricing,
      displayName: s.displayName || s.size,
      sku: s.sku || sp.sku,
      sellingPrice: s.sellingPrice ?? 0,
      costPrice: s.costPrice ?? sp.costPrice ?? 0,
      wholesalePrice: s.wholesalePrice,
      availableStock: s.availableStock ?? s.stock ?? 0,
      unitsPerPack: s.unitsPerPack ?? 1,
    })),
  };
}

export async function loadCataloguePage({
  token,
  warehouseId,
  query,
  filters,
  page,
  facets,
  signal,
  pricelistId,
  quantities,
}: {
  token: string;
  pricelistId?: string;
  quantities?: Record<string, number>;
  warehouseId?: string;
  query: string;
  filters: CatalogueFilters;
  page: number;
  facets: boolean;
  signal: AbortSignal;
}): Promise<CataloguePage> {
  const params = new URLSearchParams({
    view: 'catalogue',
    pricing: 'true',
    pricelistId: pricelistId || '',
    quantities: JSON.stringify(quantities || {}),
    page: String(page),
    limit: '24',
    search: query,
    categories: filters.categories.join(','),
    brands: filters.brands.join(','),
    types: filters.types.join(','),
    inStock: String(filters.inStock),
    catalogueSort: filters.sort,
    facets: String(facets),
  });
  if (warehouseId) params.set('warehouseId', warehouseId);
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/subproducts?${params}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal,
    }
  );
  const body = (await response.json()) as {
    success?: boolean;
    message?: string;
    data?: {
      subProducts: RawProduct[];
      pagination: CataloguePage['pagination'];
      facets?: CataloguePage['facets'];
    };
  };
  if (
    !response.ok ||
    !body.success ||
    !body.data?.pagination ||
    !Array.isArray(body.data.subProducts)
  ) {
    throw new Error(
      body.message || 'Unable to load the catalogue. Please retry.'
    );
  }
  const validPrice = (quote?: CatalogSalesPricing) =>
    quote &&
    Number.isFinite(quote.unitPrice) &&
    quote.unitPrice >= 0 &&
    quote.quantity >= 1;
  if (
    !body.data.subProducts.every((product) =>
      !product.sellWithoutSizeVariants && product.sizes?.length
        ? product.sizes.every((size) => validPrice(size.salesPricing))
        : validPrice(product.salesPricing)
    )
  ) {
    throw new Error(
      'Catalogue prices could not be calculated. Please refresh and retry.'
    );
  }
  return {
    products: body.data.subProducts.map(mapCatalogueProduct),
    pagination: body.data.pagination,
    facets: body.data.facets,
  };
}

// app/shared/purchases/purchases-catalog-data.ts
//
// Data plumbing for the purchase-form Catalogue modal. It reuses the same
// catalogue endpoint as sales (search, category/brand/type filters, facets,
// pagination, warehouse scoping) but NOT the sales pricing engine — a purchase
// order is what we PAY, so the card prices by `costPrice` and the selections
// below carry cost into the purchase line's `unitPrice`.
import { mapCatalogueProduct, type CatalogueFilters, type CataloguePage } from '../sales/sales-catalog-data';
import type { CatalogProduct } from '../sales/sales-catalog-pricing';
import type { ProductLineSelection } from '../sales/product-line-search';

/** Catalogue page without the sales pricing engine in the loop. */
export async function loadPurchaseCataloguePage({
  token,
  warehouseId,
  query,
  filters,
  page,
  facets,
  signal,
  // Accepted for loader-signature parity with the sales loader; a purchase
  // order has no pricelist and quantities don't change the price.
  }: {
  token: string;
  warehouseId?: string;
  query: string;
  filters: CatalogueFilters;
  page: number;
  facets: boolean;
  signal: AbortSignal;
  pricelistId?: string;
  quantities?: Record<string, number>;
}): Promise<CataloguePage> {
  const params = new URLSearchParams({
    view: 'catalogue',
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
      subProducts: unknown[];
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
  return {
    products: body.data.subProducts
      .map((sp) => mapCatalogueProduct(sp as Parameters<typeof mapCatalogueProduct>[0])),
    pagination: body.data.pagination,
    facets: body.data.facets,
  };
}

/** Selection for a sizeless add — cost is both the display and the wire price. */
export function purchaseSizelessSelection(p: CatalogProduct): ProductLineSelection {
  return {
    name: p.name,
    sku: p.sku,
    subProductId: p._id,
    productId: p.productId,
    // Priced at cost: the purchase line's Unit Price seeds from costPrice.
    sellingPrice: p.costPrice,
    costPrice: p.costPrice,
    taxRate: p.taxRate ?? 0,
    availableStock: p.availableStock ?? p.totalStock ?? undefined,
  };
}

/** Selection for a sized add — the size's cost, pack size and SKU win. */
export function purchaseSizeSelection(
  p: CatalogProduct,
  s: {
    size: string;
    displayName?: string;
    sku?: string;
    costPrice: number;
    taxRate?: number;
    unitsPerPack?: number;
    availableStock?: number;
  }
): ProductLineSelection {
  return {
    name: `${p.name} – ${s.displayName ?? s.size}`,
    sku: s.sku ?? p.sku,
    subProductId: p._id,
    productId: p.productId,
    sellingPrice: s.costPrice,
    costPrice: s.costPrice,
    taxRate: p.taxRate ?? 0,
    unitsPerPack: s.unitsPerPack && s.unitsPerPack > 1 ? s.unitsPerPack : 1,
    sizeId: s.size,
    sizeName: s.displayName ?? s.size,
    availableStock: s.availableStock ?? undefined,
  };
}

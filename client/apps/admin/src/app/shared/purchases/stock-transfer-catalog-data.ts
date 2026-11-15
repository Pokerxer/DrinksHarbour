import type {
  CatalogueFilters,
  CataloguePage,
} from '../sales/sales-catalog-data';
import type { CatalogProduct } from '../sales/sales-catalog-pricing';

export interface TransferCatalogRow {
  subProductId: string;
  sizeId?: string;
  sizeName?: string;
  name: string;
  sku: string;
  productSku?: string;
  image?: string;
  quantity: number;
  unitsPerPack: number;
  costPrice: number;
  wholesalePrice: number;
}

export const transferStockKey = (subProductId: string, sizeId?: string) =>
  `${subProductId}::${sizeId || ''}`;

export function transferCataloguePrice(
  row: TransferCatalogRow,
  mode: 'cost' | 'wholesale'
) {
  return mode === 'wholesale'
    ? row.wholesalePrice || row.costPrice
    : row.costPrice;
}

export function buildTransferCatalogue(
  rows: TransferCatalogRow[],
  mode: 'cost' | 'wholesale'
) {
  const groups = new Map<string, CatalogProduct>();
  const rowsByKey = new Map<string, TransferCatalogRow>();

  for (const row of rows) {
    if (row.quantity <= 0) continue;
    rowsByKey.set(transferStockKey(row.subProductId, row.sizeId), row);
    const groupKey = transferStockKey(
      row.subProductId,
      row.sizeId ? 'sized' : undefined
    );
    const cost = transferCataloguePrice(row, mode);
    let product = groups.get(groupKey);
    if (!product) {
      product = {
        _id: row.subProductId,
        name: row.name,
        sku: row.sizeId ? (row.productSku ?? '') : row.sku,
        image: row.image,
        baseSellingPrice: 0,
        costPrice: cost,
        taxRate: 0,
        availableStock: 0,
        sellWithoutSizeVariants: !row.sizeId,
        sizes: [],
      };
      groups.set(groupKey, product);
    }
    product.availableStock = (product.availableStock ?? 0) + row.quantity;
    product.costPrice = Math.min(product.costPrice, cost);
    if (row.sizeId) {
      product.sizes.push({
        size: row.sizeId,
        displayName: row.sizeName ?? row.sku,
        sku: row.sku,
        sellingPrice: 0,
        costPrice: cost,
        availableStock: row.quantity,
        unitsPerPack: row.unitsPerPack,
      });
    }
  }
  return { products: Array.from(groups.values()), rowsByKey };
}

export function paginateTransferCatalogue(
  products: CatalogProduct[],
  query: string,
  sort: CatalogueFilters['sort'],
  requestedPage: number
): CataloguePage {
  const terms = query
    .split(/[,;\n]/)
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean);
  const matching = products.filter((product) => {
    if (!terms.length) return true;
    const fields = [
      product.name,
      product.sku,
      ...product.sizes.flatMap((size) => [size.displayName, size.sku]),
    ];
    return terms.some((term) =>
      fields.some((field) => field?.toLowerCase().includes(term))
    );
  });

  matching.sort((a, b) => {
    if (sort === 'priceAsc') return a.costPrice - b.costPrice;
    if (sort === 'priceDesc') return b.costPrice - a.costPrice;
    if (sort === 'stock')
      return (b.availableStock ?? 0) - (a.availableStock ?? 0);
    return a.name.localeCompare(b.name);
  });

  const pageSize = 24;
  const total = matching.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, pages);
  return {
    products: matching.slice((page - 1) * pageSize, page * pageSize),
    pagination: {
      page,
      total,
      pages,
      hasNext: page < pages,
      hasPrev: page > 1,
    },
  };
}

import type { StockRow } from '@/services/warehouseStock.service';
import {
  FILTER_STATIC,
  type BrandItem,
  type CatItem,
  type ProdMeta,
} from '../warehouse-analysis-helpers';
type Option = { _id: string; name: string };
const sorted = <T extends Option>(items: Map<string, T>): T[] =>
  Array.from(items.values()).sort((a, b) => a.name.localeCompare(b.name));

export function analysisFilterOptions(stock: StockRow[], meta: Record<string, ProdMeta>) {
  const products = new Map<string, Option>();
  const warehouses = new Map<string, Option>();
  const categories = new Map<string, CatItem>();
  const brands = new Map<string, BrandItem>();
  for (const row of stock) {
    if (row.subProductId)
      products.set(String(row.subProductId), {
        _id: String(row.subProductId),
        name: `${row.productName || 'Unnamed product'}${row.sku ? ` · ${row.sku}` : ''}`,
      });
    if (row.warehouseId)
      warehouses.set(String(row.warehouseId), {
        _id: String(row.warehouseId),
        name: row.warehouseName || 'Unnamed warehouse',
      });
    const product = meta[String(row.subProductId)];
    if (!product) continue;
    if (product.catId)
      categories.set(product.catId, { _id: product.catId, name: product.catName, level: 0 });
    if (product.subCatId)
      categories.set(product.subCatId, {
        _id: product.subCatId,
        name: product.subCatName || product.subCatId,
        parent: product.catId,
        level: 1,
      });
    if (product.brandId)
      brands.set(product.brandId, { _id: product.brandId, name: product.brandName });
  }
  return {
    products: sorted(products),
    warehouses: sorted(warehouses),
    categories: sorted(categories),
    brands: sorted(brands),
  };
}

export function analysisFilterLabel(
  key: string,
  options: ReturnType<typeof analysisFilterOptions>,
) {
  for (const [prefix, label] of [
    ['product_search:', 'Product'],
    ['warehouse_search:', 'Warehouse'],
    ['catname_search:', 'Category'],
  ]) {
    if (key.startsWith(prefix)) return `${label}: ${key.slice(prefix.length)}`;
  }
  const facets: [string, string, Option[]][] = [
    ['product_', 'Product', options.products],
    ['warehouse_', 'Warehouse', options.warehouses],
    ['category_', 'Category', options.categories],
    ['subcategory_', 'Subcategory', options.categories],
    ['brand_', 'Brand', options.brands],
  ];
  for (const [prefix, label, choices] of facets)
    if (key.startsWith(prefix))
      return `${label}: ${choices.find((choice) => choice._id === key.slice(prefix.length))?.name || 'Unavailable selection'}`;
  return FILTER_STATIC.find((filter) => filter.key === key)?.label || key;
}

import type { PurchaseOrder, POItem } from '@/services/purchaseOrder.service';
import type { ProdMeta } from './purchases-analytics-helpers';
import { itemName, itemSubProductKey } from './purchases-analytics-helpers';
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
const values = (filters: string[], prefix: string) =>
  filters.filter((f) => f.startsWith(prefix)).map((f) => f.slice(prefix.length));
const searchMatches = (text: string, queries: string[]) =>
  !queries.length ||
  queries.some((q) =>
    normalize(q)
      .split(/[,;\n]/)
      .filter(Boolean)
      .some((term) =>
        term
          .trim()
          .split(/\s+/)
          .every((word) => normalize(text).includes(word)),
      ),
  );

/** OR within a filter dimension, AND across dimensions, all on the same line. */
export function projectPurchaseLines(
  orders: PurchaseOrder[],
  filters: string[],
  meta: Record<string, ProdMeta>,
): PurchaseOrder[] {
  const ids = values(filters, 'product_id:');
  const searches = values(filters, 'product_search:');
  const categories = values(filters, 'category_');
  const subcategories = values(filters, 'subcategory_');
  const brands = values(filters, 'brand_');
  const names = values(filters, 'catname_search:');
  if (![ids, searches, categories, subcategories, brands, names].some((v) => v.length))
    return orders;
  const matches = (item: POItem) => {
    const id = itemSubProductKey(item);
    const m = meta[id];
    const populated = item.subProductId as unknown as { sku?: string } | null;
    return (
      (!ids.length || ids.includes(id)) &&
      searchMatches(`${itemName(item)} ${item.sku || populated?.sku || ''}`, searches) &&
      (!categories.length || categories.includes(m?.catId || '')) &&
      (!subcategories.length || subcategories.includes(m?.subCatId || '')) &&
      (!brands.length || brands.includes(m?.brandId || '')) &&
      searchMatches(`${m?.catName || ''} ${m?.subCatName || ''}`, names)
    );
  };
  return orders
    .map((o) => ({ ...o, items: (o.items || []).filter(matches) }))
    .filter((o) => o.items.length > 0);
}
export function filterPurchaseHistory(orders: PurchaseOrder[], filters: string[]): PurchaseOrder[] {
  const from = values(filters, 'created_from:')[0];
  const to = values(filters, 'created_to:')[0];
  const refs = values(filters, 'reference:');
  return orders.filter((o) => {
    const created = new Date(o.createdAt || '').getTime();
    return (
      (!from || created >= Date.parse(`${from}T00:00:00Z`)) &&
      (!to || created < Date.parse(`${to}T00:00:00Z`) + 86400000) &&
      searchMatches(`${o.poNumber || ''} ${o.vendorReference || ''}`, refs)
    );
  });
}

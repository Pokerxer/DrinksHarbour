import type { SortCol, SortDir } from './inventory-stock-search';
export interface StockViewSettings {
  productIds?: string[];
  expiryFrom?: string;
  expiryTo?: string;
  sortCol?: SortCol;
  sortDir?: SortDir;
}
const columns: SortCol[] = [
  'relevance',
  'product',
  'size',
  'warehouse',
  'onhand',
  'reserved',
  'available',
  'cost',
  'method',
  'value',
  'status',
];
export function restoreStockView(view: StockViewSettings) {
  return {
    productIds: Array.isArray(view.productIds)
      ? view.productIds.filter((id) => typeof id === 'string')
      : [],
    expiryFrom: typeof view.expiryFrom === 'string' ? view.expiryFrom : '',
    expiryTo: typeof view.expiryTo === 'string' ? view.expiryTo : '',
    sortCol: columns.includes(view.sortCol as SortCol) ? view.sortCol! : ('product' as SortCol),
    sortDir: view.sortDir === 'desc' ? ('desc' as SortDir) : ('asc' as SortDir),
  };
}

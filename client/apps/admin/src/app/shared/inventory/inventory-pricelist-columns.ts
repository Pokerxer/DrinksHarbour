import { quotePriceColumn } from './inventory-pricelist-quote';
import {
  dedupeRowsForPricelist,
  type PricableStockLine,
  type PricelistLite,
} from './inventory-pricelist-print';

export type PriceColumnMode = 'auto' | 'unit' | 'bundle';
export interface PriceColumn {
  label: string;
  pricelist: PricelistLite | null;
  mode: PriceColumnMode;
}
export interface PriceQuote {
  note?: string;
  price: number | null;
  was: number | null;
  quantity: number | null;
  unitPrice: number | null;
}

/** Each column starts from the original size prices; no column feeds another. */
export function buildPriceColumnGrid(
  rows: PricableStockLine[],
  columns: PriceColumn[],
  discountPercent = 0
) {
  const originals = dedupeRowsForPricelist(rows).sort(
    (a, b) =>
      a.categoryName.localeCompare(b.categoryName) ||
      a.productName.localeCompare(b.productName) ||
      a.sizeName.localeCompare(b.sizeName)
  );
  const discount = Number.isFinite(discountPercent)
    ? Math.max(0, Math.min(90, discountPercent))
    : 0;
  const quotes = columns.map((column) => {
    if (column.pricelist && !Array.isArray(column.pricelist.rules))
      throw new Error(
        `Load rules for ${column.pricelist.name} before exporting`
      );
    return originals.map((row) => quotePriceColumn(row, column, discount));
  });
  return {
    columns,
    rows: originals.map((line, index) => ({
      line,
      prices: quotes.map((column) => column[index] as PriceQuote),
    })),
  };
}

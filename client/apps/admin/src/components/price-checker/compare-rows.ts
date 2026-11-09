import type { KioskProduct } from './types';
import { formatMoney } from './money';
import { typeLabel } from './metrics';

const STOCK: Record<string, string> = {
  IN_STOCK: 'In stock',
  LOW_STOCK: 'Low stock',
  OUT_OF_STOCK: 'Out of stock',
};

interface RowDef {
  label: string;
  value: (product: KioskProduct) => string | undefined;
}

const defs: RowDef[] = [
  { label: 'Brand', value: (product) => product.brand },
  { label: 'Size', value: (product) => product.size || product.volume },
  { label: 'Type', value: (product) => typeLabel(product.beverageType) },
  {
    label: 'ABV',
    value: (product) => (product.abv !== undefined ? `${product.abv}%` : undefined),
  },
  { label: 'Origin', value: (product) => product.origin },
  {
    label: 'Category',
    value: (product) => (product.alcoholic ? 'Alcoholic' : 'Non-alcoholic'),
  },
  {
    label: 'Stock',
    value: (product) =>
      product.availability ? STOCK[product.availability] : undefined,
  },
];

export interface CompareRow {
  label: string;
  values: (string | undefined)[];
  /** True when every bottle defines the same value for this row. */
  shared: boolean;
}

export function rowsFor(items: KioskProduct[]): CompareRow[] {
  return defs
    .map((def) => {
      const values = items.map((product) => def.value(product));
      const defined = values.filter((value) => value !== undefined);
      return {
        label: def.label,
        values,
        shared:
          defined.length === items.length && new Set(defined).size === 1,
      };
    })
    .filter((row) => row.values.some((value) => value !== undefined));
}

/**
 * One decision sentence for the compare screen: shared attributes in the
 * lead, the most decision-relevant difference at the close (price spread,
 * then size, then brand). Returns null for 0/1 items or when everything —
 * price included — is shared.
 */
export function decisionHeadline(
  items: KioskProduct[],
  currency: string
): string | null {
  if (items.length < 2) return null;
  const rows = rowsFor(items);
  const sharedRows = rows.filter((row) => row.shared);
  const prices = items.map((product) => product.price);
  if (sharedRows.length === rows.length && new Set(prices).size === 1)
    return null;
  const who = items.length === 2 ? 'Both bottles' : `All ${items.length} bottles`;
  const lead = sharedRows
    .map((row) => row.values[0])
    .slice(0, 3)
    .join(' · ');
  let difference: string;
  if (new Set(prices).size > 1) {
    const spread = Math.max(...prices) - Math.min(...prices);
    difference = `price (${formatMoney(spread, currency)})`;
  } else {
    const sizing = items.map((product) => product.size || product.volume);
    difference =
      new Set(sizing.filter(Boolean)).size > 1
        ? `size (${sizing.filter(Boolean).join(' vs ')})`
        : new Set(items.map((product) => product.brand)).size > 1
          ? `brand (${items
              .map((product) => product.brand)
              .filter(Boolean)
              .join(' vs ')})`
          : 'the details shown below';
  }
  const sentence =
    lead.length > 0
      ? `${who} share ${lead}. Main difference: ${difference}.`
      : `Main difference: ${difference}.`;
  return sentence;
}

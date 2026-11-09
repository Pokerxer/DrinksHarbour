import type { KioskProduct } from './types';
import { formatMoney } from './money';
import { typeLabel } from './metrics';
import { t, type Language } from './copy';

const STOCK: Record<string, string> = {
  IN_STOCK: 'inStock',
  LOW_STOCK: 'lowStock',
  OUT_OF_STOCK: 'outOfStock',
};

interface RowDef {
  labelKey: Parameters<typeof t>[1];
  value: (product: KioskProduct, lang: Language) => string | undefined;
}

const defs: RowDef[] = [
  { labelKey: 'brand', value: (product) => product.brand },
  { labelKey: 'size', value: (product) => product.size || product.volume },
  { labelKey: 'type', value: (product) => typeLabel(product.beverageType) },
  {
    labelKey: 'abv',
    value: (product) => (product.abv !== undefined ? `${product.abv}%` : undefined),
  },
  { labelKey: 'origin', value: (product) => product.origin },
  {
    labelKey: 'category',
    value: (product) => (product.alcoholic ? 'Alcoholic' : 'Non-alcoholic'),
  },
  {
    labelKey: 'stock',
    value: (product, lang) =>
      product.availability ? t(lang, STOCK[product.availability] as never) : undefined,
  },
];

export interface CompareRow {
  label: string;
  values: (string | undefined)[];
  /** True when every bottle defines the same value for this row. */
  shared: boolean;
}

export function rowsFor(items: KioskProduct[], lang: Language = 'en'): CompareRow[] {
  return defs
    .map((def) => {
      const values = items.map((product) => def.value(product, lang));
      const defined = values.filter((value) => value !== undefined);
      return {
        label: t(lang, def.labelKey) as string,
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
  currency: string,
  lang: Language = 'en'
): string | null {
  if (items.length < 2) return null;
  const rows = rowsFor(items, lang);
  const sharedRows = rows.filter((row) => row.shared);
  const prices = items.map((product) => product.price);
  if (sharedRows.length === rows.length && new Set(prices).size === 1)
    return null;
  const lead = sharedRows
    .map((row) => row.values[0])
    .slice(0, 3)
    .join(' · ');
  let difference: string;
  if (new Set(prices).size > 1) {
    const spread = Math.max(...prices) - Math.min(...prices);
    difference = t(lang, 'diffPrice', { value: formatMoney(spread, currency) });
  } else {
    const sizing = items.map((product) => product.size || product.volume);
    difference =
      new Set(sizing.filter(Boolean)).size > 1
        ? t(lang, 'diffSize', { values: sizing.filter(Boolean).join(' vs ') })
        : new Set(items.map((product) => product.brand)).size > 1
          ? t(lang, 'diffBrand', {
              values: items.map((product) => product.brand).filter(Boolean).join(' vs '),
            })
          : t(lang, 'diffBelow');
  }
  const sentence =
    lead.length > 0
      ? t(
          lang,
          items.length === 2 ? 'headlineBoth' : 'headlineAll',
          { lead, difference, n: items.length }
        )
      : t(lang, 'headlineLeadOnly', { difference });
  return sentence;
}

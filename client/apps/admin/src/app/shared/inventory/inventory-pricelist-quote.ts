import {
  applyRuleTransform,
  findMatchingPricelistRules,
} from '@/app/shared/point-of-sale/utils';
import {
  resolveBundlePriceForRow,
  rulesInPriorityOrder,
  type PricelistPrintRow,
} from './inventory-pricelist-print';
import type { PriceColumn, PriceQuote } from './inventory-pricelist-columns';

const round = (n: number) => Math.round(n * 100) / 100;
const unavailable = (note: string): PriceQuote => ({
  price: null,
  was: null,
  quantity: null,
  unitPrice: null,
  note,
});

/** A pack quote can use per-unit formula rules without requiring a bundle deal. */
export function quotePriceColumn(
  row: PricelistPrintRow,
  column: PriceColumn,
  discountPercent: number
): PriceQuote {
  const rules = rulesInPriorityOrder(column.pricelist);
  const seedBundle =
    column.mode === 'unit'
      ? null
      : resolveBundlePriceForRow(row, column.pricelist, row.sellingPrice);
  const quantity =
    seedBundle?.bundleQuantity ??
    (column.mode === 'bundle' ? row.unitsPerPack : 1);
  if (column.mode === 'bundle' && (!Number.isInteger(quantity) || quantity < 2))
    return unavailable('Set units per pack to quote a pack total');
  const priceRules = findMatchingPricelistRules(
    rules,
    row.subProductId,
    quantity,
    'price'
  );
  const bundleRules =
    column.mode === 'unit'
      ? []
      : findMatchingPricelistRules(rules, row.subProductId, quantity, 'bundle');
  const uncovered =
    !!column.pricelist && priceRules.length === 0 && bundleRules.length === 0;
  let unitPrice = uncovered ? row.wholesalePrice : row.sellingPrice;
  if (uncovered && unitPrice <= 0)
    return unavailable('No matching rule or saved wholesale price');
  if (
    priceRules.some(
      (rule) =>
        rule.priceType === 'formula' &&
        (rule.markupBase === 'wholesale'
          ? row.wholesalePrice
          : row.costPrice) <= 0
    )
  )
    return unavailable('The formula price basis is missing');
  for (const rule of priceRules)
    unitPrice = applyRuleTransform(
      unitPrice,
      rule,
      row.costPrice,
      row.wholesalePrice
    );
  const bundle =
    column.mode === 'unit'
      ? null
      : resolveBundlePriceForRow(row, column.pricelist, unitPrice);
  if (
    bundleRules.length &&
    bundle?.bundleTotal == null &&
    priceRules.length === 0
  )
    return unavailable(
      'No eligible bundle price; check its basis and quantity'
    );
  const qty = bundle?.bundleQuantity ?? quantity;
  const total = bundle?.bundleTotal ?? unitPrice * qty;
  const factor = 1 - Math.max(0, Math.min(90, discountPercent)) / 100;
  const price = round(total * factor);
  return {
    price,
    was:
      discountPercent > 0
        ? round(total)
        : uncovered
          ? null
          : Math.abs(total - row.sellingPrice * qty) > 0.001
            ? round(row.sellingPrice * qty)
            : null,
    quantity: qty > 1 ? qty : null,
    unitPrice: round((bundle?.bundlePrice ?? unitPrice) * factor),
    note: uncovered ? 'Saved wholesale price' : undefined,
  };
}

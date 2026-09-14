import type { SalesLineItem } from '@/services/salesOrder.service';
import type { DraftLine } from './sales-line-table';
import { soItemToDraftLine } from './sales-create-pricing-helpers';

/** A pricing-only response must not cause a catalog request for every line. */
export function mergeRepricedLines(
  previous: DraftLine[],
  items: SalesLineItem[]
): DraftLine[] {
  const remaining = new Set(previous);
  return items.map((item) => {
    const line = soItemToDraftLine(item);
    const matches = (old: DraftLine) =>
      old.lineType === line.lineType &&
      old.subProductId === line.subProductId &&
      old.sizeId === line.sizeId;
    const old =
      previous.find(
        (old) => remaining.has(old) && old.key === line.key && matches(old)
      ) ?? previous.find((old) => remaining.has(old) && matches(old));
    if (!old) return line;
    remaining.delete(old);
    return {
      ...line,
      sizeName: old.sizeName,
      costPrice: old.costPrice,
      availableStock: old.availableStock,
      activeBundles: old.activeBundles,
      originalPrice: old.originalPrice,
    };
  });
}

export function pricingSignature(
  lines: DraftLine[],
  pricelistId: string
): string {
  const parts = lines
    .filter(
      (l) => l.lineType === 'product' && l.subProductId && !l.priceOverridden
    )
    .map((l) => [l.key, l.subProductId, l.sizeId ?? '', l.quantity]);
  return parts.length ? JSON.stringify([pricelistId, parts]) : '';
}

/** Share an in-flight action, including the save preceding a price update. */
export function singleFlight() {
  let pending: Promise<unknown> | null = null;
  return function run<T>(action: () => Promise<T>): Promise<T> {
    if (pending) return pending as Promise<T>;
    const result = Promise.resolve()
      .then(action)
      .finally(() => {
        pending = null;
      });
    pending = result;
    return result;
  };
}

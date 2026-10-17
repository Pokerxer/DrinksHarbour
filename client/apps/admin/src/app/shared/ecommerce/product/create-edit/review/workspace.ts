import {
  buildOverrides,
  evaluatePrice,
  initialDrafts,
  suggestPrice,
  saleActive,
} from './pricing';
import type { PriceDraft, PriceLine, PriceTargets, ReviewListing } from './types';
export type RowFilter = 'all' | 'changed' | 'attention' | 'blocked';
const different = (entered: string, original: string) => {
  if (entered.trim() === original.trim()) return false;
  if (!entered.trim() || !original.trim()) return true;
  return !Number.isFinite(Number(entered)) || Number(entered) !== Number(original);
};
export function inspectRows(
  lines: PriceLine[],
  drafts: Record<string, PriceDraft>,
  listing: ReviewListing,
  targets: PriceTargets
) {
  const originals = initialDrafts(lines);
  return lines.map((line) => {
    const draft = drafts[line.id] || originals[line.id];
    const normalChanged = different(draft.normal, originals[line.id].normal);
    const packChanged =
      !!draft.pack.trim() && different(draft.pack, originals[line.id].pack);
    const normal = evaluatePrice(line, draft.normal, listing, targets);
    const pack =
      draft.pack.trim() &&
      !saleActive(listing) &&
      !line.pricing.productDiscount?.active
        ? evaluatePrice(
            line,
            draft.pack,
            listing,
            targets,
            true,
            Number(draft.normal)
          )
        : null;
    let error: string | null = null;
    try {
      buildOverrides([line], { [line.id]: draft }, listing);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Check this price.';
    }
    const attention =
      !!error ||
      normal.supplier === null ||
      normal.tenantTargetMet === false ||
      normal.platformTargetMet === false ||
      !!pack?.error ||
      pack?.tenantTargetMet === false ||
      pack?.platformTargetMet === false;
    return {
      line,
      draft,
      changed: normalChanged || packChanged,
      normalChanged,
      packChanged,
      normal,
      pack,
      error,
      attention,
    };
  });
}
export type ReviewRow = ReturnType<typeof inspectRows>[number];
export function filterRows(rows: ReviewRow[], query: string, filter: RowFilter) {
  const search = query.trim().toLocaleLowerCase();
  return rows.filter(
    (row) =>
      (filter === 'all' ||
        (filter === 'changed'
          ? row.changed
          : filter === 'blocked'
            ? !!row.error
            : row.attention)) &&
      (!search ||
        `${row.line.label} ${row.line.sku || ''}`
          .toLocaleLowerCase()
          .includes(search))
  );
}
/** Apply only viable normal-price proposals to rows with no manual edits. */
export function applyUnchangedSuggestions(
  lines: PriceLine[],
  drafts: Record<string, PriceDraft>,
  listing: ReviewListing,
  targets: PriceTargets
) {
  const result = Object.fromEntries(
    Object.entries(drafts).map(([id, value]) => [id, { ...value }])
  );
  for (const row of inspectRows(lines, drafts, listing, targets)) {
    if (
      row.changed ||
      row.pack?.error ||
      row.pack?.tenantTargetMet === false ||
      row.pack?.platformTargetMet === false
    )
      continue;
    const suggestion = suggestPrice(row.line, listing, targets);
    if (suggestion === null) continue;
    const outcome = evaluatePrice(row.line, String(suggestion), listing, targets);
    if (
      outcome.error ||
      outcome.tenantTargetMet === false ||
      outcome.platformTargetMet === false
    )
      continue;
    result[row.line.id] = { ...row.draft, normal: String(suggestion) };
  }
  return result;
}

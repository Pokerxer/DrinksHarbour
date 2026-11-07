// Grouped rendering helpers for the Product Type pickers (product
// identification form + the tenant Sub-Product identification form, kept
// identical so both flows behave the same).
//
// The type palette grew the retail verticals (Electronics / Fashion / Beauty /
// Home) and the foodservice/hospitality supply round — close to 100 options.
// Browsing a flat list reads as one long soup, so in BROWSE mode each new
// category gets a non-selectable heading row (uppercase, gray footnote style,
// mirroring the sizes quick-add group headings) while in SEARCH mode the list
// collapses back to flat results so headings can't filter to empty groups.
//
// Pure option building lives in buildProductTypeOptions (unit-tested;
// colocated file ./product-type-options.test.ts) and this module stays
// drop-in compatible with rizzui's Select: each non-heading option keeps
// { value, label, category } so search matching, onChange(option.value) and
// the selected-value display all behave exactly as before.

export interface ProductTypeOption {
  value: string;
  label: string;
  category: string;
}

export interface ProductTypeSelectOption extends ProductTypeOption {
  disabled?: boolean;
  isHeading?: boolean;
}

/** Values are intentionally namespaced so a heading can never collide with a
 * real type value (Listbox options are enabled=false anyway, but keys must be
 * unique across the list). */
export const PRODUCT_TYPE_HEADING_VALUE_PREFIX = '__group::';

/**
 * Build the rizzui Select options for a product-type picker.
 *
 * - No search term: one disabled heading per category, in first-seen order.
 *   Options within each category retain their original order.
 * - With a search term: flat matched options only (label, category or value
 *   match), no headings — a heading whose children all filtered out would be
 *   noise, and the chip on each row still carries the group name.
 */
export function buildProductTypeOptions(
  types: readonly ProductTypeOption[],
  search = ''
): ProductTypeSelectOption[] {
  const term = search.trim().toLowerCase();
  const matches = (option: ProductTypeOption) =>
    !term ||
    option.label.toLowerCase().includes(term) ||
    option.category.toLowerCase().includes(term) ||
    option.value.includes(term);
  const matched = types.filter(matches).map(option => ({ ...option }));
  if (term) return matched;

  const groups = new Map<string, ProductTypeSelectOption[]>();
  for (const option of matched) {
    const group = groups.get(option.category);
    if (group) group.push(option);
    else groups.set(option.category, [option]);
  }

  return Array.from(groups, ([category, group]) => [
    {
      value: `${PRODUCT_TYPE_HEADING_VALUE_PREFIX}${category}`,
      label: category,
      category,
      disabled: true,
      isHeading: true,
    },
    ...group,
  ]).flat();
}

/**
 * Per-row content for the pickers: the type name left, its group as a
 * subordinate right-aligned chip (gray-100 / gray-500 footnote pair, the same
 * chip treatment as colors & variants in the tables); heading rows render the
 * uppercase gray group title instead.
 */
export function ProductTypeOptionContent({
  option,
}: {
  option: ProductTypeSelectOption;
}) {
  if (option.isHeading) {
    return (
      <span className="flex h-6 items-center text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {option.label}
      </span>
    );
  }
  return (
    <span className="flex w-full items-center justify-between gap-3">
      <span className="min-w-0 truncate">{option.label}</span>
      <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500">
        {option.category}
      </span>
    </span>
  );
}

type SizeVariantLabelFields = {
  displayName?: string | null;
  size?: string | null;
  colorName?: string | null;
  optionName?: string | null;
};

export function sizeVariantLabel(size: SizeVariantLabelFields): string {
  return [size.displayName ?? size.size, size.colorName, size.optionName]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Size label for a FLAT reporting row whose size fields have been denormalized
 * onto the row itself (warehouse stock rows, stored transfer lines — DRI-17).
 * Colour/option are additive: when the row carries retail variant data the full
 * identity is composed; colourless/legacy rows resolve to the stored `sizeName`
 * byte-for-byte (every legacy beverage row never has colour/option).
 */
type FlatSizeRowFields = {
  sizeName?: string | null;
  colorName?: string | null;
  optionName?: string | null;
};

export function flatRowSizeLabel(row: FlatSizeRowFields): string {
  return sizeVariantLabel({
    size: row.sizeName ?? null,
    colorName: row.colorName ?? null,
    optionName: row.optionName ?? null,
  });
}

type StoredSizeLineFields = { sizeName?: string | null; sizeSize?: string | null };

/**
 * Size label for a stored line (DRI-14 label consistency). A snapshot of the
 * stored `sizeName` is authoritative for legacy rows — when the line carries a
 * populated Size identity with retail variant data (colour/option, which every
 * legacy beverage Size row never has), compose via `sizeVariantLabel` so those
 * surfaces keep the identity that surface's PO/transfer flows already show.
 * Legacy/colourless rows resolve to the stored `sizeName` byte-for-byte.
 */
export function lineSizeLabel(
  line: { sizeName?: string | null },
  size?: SizeVariantLabelFields | null
): string {
  if (size && (size.colorName || size.optionName)) return sizeVariantLabel(size);
  return line.sizeName ?? '';
}

/** Narrows a possibly-populated Size ref on a stored line to identity fields. */
export function populatedSizeIdentity(sizeRef: unknown): SizeVariantLabelFields | null {
  if (!sizeRef || typeof sizeRef !== 'object') return null;
  const s = sizeRef as SizeVariantLabelFields;
  if (s.colorName || s.optionName) return s;
  return null;
}

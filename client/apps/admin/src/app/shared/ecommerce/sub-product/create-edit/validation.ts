export interface SizeRowLike {
  size?: string | null;
}

export const MISSING_SIZE_MSG = (count: number): string =>
  `${count} size variant(s) are missing a size selection`;

export const DUPLICATE_SIZE_MSG = (value: string): string =>
  `Duplicate size value "${value}". Each size value can only appear once per product.`;

/**
 * Validate size rows before saving a sub-product.
 *
 * When `sellWithoutSizeVariants` is true the size rows stay in the form,
 * hidden and restorable, so they must NEVER block a save — returns [].
 * Error message text matches the previous inline guards exactly.
 */
export function validateSizeVariants(
  sizes: SizeRowLike[] | undefined,
  sellWithoutSizeVariants: boolean
): string[] {
  if (sellWithoutSizeVariants) return [];
  const rows = sizes || [];
  const errors: string[] = [];

  const missingCount = rows.filter(
    (s) => !s.size || s.size.trim() === ''
  ).length;
  if (missingCount > 0) errors.push(MISSING_SIZE_MSG(missingCount));

  const seen = new Map<string, string>();
  for (const s of rows) {
    if (!s.size) continue;
    const key = String(s.size).toLowerCase().trim();
    if (seen.has(key)) {
      const original = seen.get(key) ?? String(s.size);
      errors.push(DUPLICATE_SIZE_MSG(original));
    } else {
      seen.set(key, String(s.size));
    }
  }

  return errors;
}

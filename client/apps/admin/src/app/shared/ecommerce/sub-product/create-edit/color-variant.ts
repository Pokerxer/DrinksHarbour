// Industry color-variant inputs for non-beverage Size rows (apparel / shoes /
// electronics). Pure helpers colocated with the size form so the payload and
// the inputs stay in lock-step with server/models/Size.js:
// - colorName: free text, stored verbatim, maxlength 60 (user casing kept)
// - colorHexCode: #RRGGBB, uppercase-normalized (server trims+uppercases too)
export const COLOR_HEX_PATTERN = /^#[0-9A-F]{6}$/;

// The hex swatch input only produces full #rrggbb values; the companion text
// input allows half-typed values while the user is editing. Incomplete
// values are treated as "not set here yet" and never block the save — the
// hex input + swatch make a complete valid value trivial to enter.
export const normalizeColorHexInput = (
  value: string | null | undefined
): string => {
  if (typeof value !== 'string') return '';
  // Keep only hex-ish characters, ensure the leading '#', uppercase.
  const hexChars = value.replace(/[^#0-9a-fA-F]/g, '');
  const withHash = hexChars.startsWith('#') ? hexChars : `#${hexChars}`;
  return withHash.toUpperCase().slice(0, 7);
};

export const isCompleteColorHex = (value: string | null | undefined): boolean =>
  typeof value === 'string' && COLOR_HEX_PATTERN.test(value);

export const COLOR_NAME_MAX_LENGTH = 60;

import { describe, expect, test } from 'vitest';

const { resolveCategoryIcon, CATEGORY_ICON_FALLBACK } = await import('./category-icons.ts');

/**
 * Port of `apps/platform/src/lib/category-icons.ts`. The colours and Tailwind
 * tints are the web's verbatim — only the glyph identity changes, because the
 * web draws Phosphor (react-icons/pi) and this draws @expo/vector-icons.
 */

describe('resolveCategoryIcon', () => {
  test('matches on slug first', () => {
    expect(resolveCategoryIcon({ slug: 'wine', name: 'Anything' }).color).toBe('#9333EA');
  });

  test('falls through to name when the slug is unknown', () => {
    expect(resolveCategoryIcon({ slug: 'zzz-unknown', name: 'Beer' }).color).toBe('#CA8A04');
  });

  test('matches partially, first key wins — "Red Wine" resolves to WINE, not red', () => {
    // Insertion order is load-bearing: `wine` precedes `red`, and the web's
    // `for (const key of Object.keys(MAP))` takes the first substring hit, so
    // "red wine".includes("wine") lands on the purple wine entry. The web does
    // exactly this — the `red` key is only reachable by an exact slug/name.
    // Do not "fix" by reordering the map; that would break parity.
    expect(resolveCategoryIcon({ slug: 'red-wine', name: 'Red Wine' }).color).toBe('#9333EA');
    expect(resolveCategoryIcon({ slug: 'red', name: 'Red' }).color).toBe('#B91C1C');
  });

  test('keeps the web tint classes so the chip matches', () => {
    expect(resolveCategoryIcon({ slug: 'gin' }).bgTint).toBe('bg-teal-50');
    expect(resolveCategoryIcon({ slug: 'stout' }).bgTint).toBe('bg-slate-100');
  });

  test("honours a category's own colour when nothing matches", () => {
    const custom = resolveCategoryIcon({ slug: 'qqq', name: 'Qqq', color: '#123456' });
    expect(custom.color).toBe('#123456');
    expect(custom.icon).toBe(CATEGORY_ICON_FALLBACK.icon);
  });

  test('falls back to the wine glass for an unknown, uncoloured category', () => {
    expect(resolveCategoryIcon({ slug: 'qqq', name: 'Qqq' })).toEqual(CATEGORY_ICON_FALLBACK);
  });

  test('never throws on empty input', () => {
    expect(resolveCategoryIcon({})).toEqual(CATEGORY_ICON_FALLBACK);
  });

  test('every mapped entry names a real glyph and a hex colour', () => {
    for (const slug of ['wine', 'whisky', 'beer', 'coffee', 'gift', 'cocktail', 'ice']) {
      const resolved = resolveCategoryIcon({ slug });
      expect(typeof resolved.icon, slug).toBe('string');
      expect(resolved.color, slug).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(resolved.bgTint, slug).toMatch(/^bg-/);
    }
  });
});

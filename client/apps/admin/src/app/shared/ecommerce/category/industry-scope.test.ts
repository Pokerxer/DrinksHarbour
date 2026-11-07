import { describe, expect, it } from 'vitest';
import { categoryFormSchema } from '@/validators/create-category.schema';
import {
  applyIndustryFilter,
  INDUSTRY_FILTER_OPTIONS,
  INDUSTRY_LABELS,
} from './category-list/industry-scope';
import { INDUSTRIES, INDUSTRY_SELECT_OPTIONS } from '@/utils/industries';
import { AdminCategory } from '@/services/category.service';

describe('category management industry scope (additive 2026-11-02)', () => {
  it('accepts every canonical industry on the create/edit form and blank = legacy', () => {
    for (const industry of INDUSTRIES) {
      const parsed = categoryFormSchema.safeParse({
        name: 'Single Malt Whisky',
        slug: 'single-malt-whisky',
        type: 'whiskey',
        industry,
      });
      expect(parsed.success).toBe(true);
    }
    // Blank/absent stays legacy/global — categories created before the field
    // existed are unchanged.
    for (const industry of ['', undefined]) {
      const parsed = categoryFormSchema.safeParse({
        name: 'Single Malt Whisky',
        slug: 'single-malt-whisky',
        type: 'whiskey',
        ...(industry !== undefined ? { industry } : {}),
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) expect(parsed.data.industry ?? '').toBe('');
    }
    const bad = categoryFormSchema.safeParse({
      name: 'Single Malt Whisky',
      slug: 'single-malt-whisky',
      type: 'whiskey',
      industry: 'software',
    });
    expect(bad.success).toBe(false);
  });

  it('offers the industry facet with a legacy option for unscoped rows', () => {
    expect(INDUSTRY_FILTER_OPTIONS[0]).toEqual({
      label: 'All Industries',
      value: '',
    });
    for (const value of INDUSTRIES) {
      expect(
        INDUSTRY_FILTER_OPTIONS.some((o) => o.value === value)
      ).toBe(true);
    }
    expect(
      INDUSTRY_FILTER_OPTIONS.some((o) => o.value === 'legacy')
    ).toBe(true);
    // Facet labels reuse the display labels (no drift between column + facet).
    for (const value of INDUSTRIES) {
      expect(INDUSTRY_LABELS[value]).toBeDefined();
      expect(
        INDUSTRY_FILTER_OPTIONS.find((o) => o.value === value)?.label
      ).toBe(INDUSTRY_LABELS[value]);
    }
  });

  it('filters the list per facet, keeping legacy rows discoverable', () => {
    const rows = [
      { _id: '1', industry: 'beverage' },
      { _id: '2', industry: 'fashion' },
      { _id: '3', industry: undefined }, // legacy/global document
      { _id: '4', industry: null },
      { _id: '5', industry: 'beverage' },
    ] as AdminCategory[];
    expect(applyIndustryFilter(rows, '')).toHaveLength(5);
    expect(
      applyIndustryFilter(rows, 'beverage').map((r) => r._id)
    ).toEqual(['1', '5']);
    expect(applyIndustryFilter(rows, 'home')).toEqual([]);
    // "legacy" is a first-class facet: documents with NO industry field.
    expect(
      applyIndustryFilter(rows, 'legacy').map((r) => r._id)
    ).toEqual(['3', '4']);
  });

  it('keeps the canon INDUSTRY option list in step with the schema', () => {
    expect(INDUSTRY_SELECT_OPTIONS.map((o) => o.value)).toEqual([
      ...INDUSTRIES,
    ]);
  });
});

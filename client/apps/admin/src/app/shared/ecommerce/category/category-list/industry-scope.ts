// Industry taxonomy scope (2026-11-02, additive). Pure helpers for the admin
// category list so the filter facet behaviour is testable without mounting the
// table. Legacy/global documents have NO `industry` field — "legacy" is a
// first-class facet value (`kind: 'legacy'`), everything else matches the
// stored value exactly.
import { INDUSTRIES } from '@/utils/industries';

export type IndustryFacet = '' | 'legacy' | string;

/** Facet / column tag labels for the canonical industry values. */
export const INDUSTRY_LABELS: Record<string, string> = {
  beverage: 'Beverages',
  hospitality: 'Hospitality',
  'food-service': 'Food Service',
  electronics: 'Electronics',
  fashion: 'Fashion',
  beauty: 'Beauty & Skincare',
  home: 'Home & Living',
};

export const INDUSTRY_FILTER_OPTIONS: ReadonlyArray<{
  label: string;
  value: IndustryFacet;
}> = [
  { label: 'All Industries', value: '' },
  ...INDUSTRIES.map((industry) => ({
    label: INDUSTRY_LABELS[industry] ?? industry,
    value: industry,
  })),
  // Human-first wording for the unscoped bucket: "legacy/global" is the
  // storage concept, what the reviewer needs to know is that these documents
  // carry no industry and are therefore visible to every business.
  { label: 'No industry (all businesses)', value: 'legacy' },
];

export function applyIndustryFilter<
  T extends { industry?: string | null },
>(rows: readonly T[], facet: IndustryFacet): T[] {
  if (!facet) return [...rows];
  if (facet === 'legacy')
    return rows.filter((row) => row.industry == null || row.industry === '');
  return rows.filter((row) => row.industry === facet);
}

import type { CalcConfig } from './types';

/** Planner checkbox ids (WeddingDrinkId). */
export type OccasionDrinkId = 'toast' | 'wine' | 'beer' | 'spirits' | 'alcohol-free';

export const OCCASION_DRINK_LABELS: Record<OccasionDrinkId, string> = {
  toast: 'Champagne & sparkling', wine: 'Wine', beer: 'Beer', spirits: 'Spirits', 'alcohol-free': 'Non-alcoholic drinks',
};

/** Maps each planner checkbox to the calculator row ids it covers, per occasion. */
export const CATEGORY_TO_ROWS: Record<string, Partial<Record<OccasionDrinkId, string[]>>> = {
  weddings: {
    toast: ['toast'],
    wine: ['meal'],
    beer: ['beer'],
    spirits: ['spirits'],
    'alcohol-free': ['water', 'soft'],
  },
  corporate: {
    toast: ['toast-sparkling'],
    wine: ['reception-wine'],
    beer: ['reception-beer'],
    spirits: ['mixing-spirits'],
    'alcohol-free': ['water-soft'],
  },
  'house-parties': {
    wine: ['wine'],
    beer: ['beers'],
    spirits: ['spirits'],
    'alcohol-free': ['mixers'],
  },
};

/** Nothing selected keeps the full config; any selection keeps only its mapped rows. */
export function rowsForSelection(config: CalcConfig, selection: string[], mapping: Partial<Record<string, string[]>> = {}): CalcConfig {
  if (!selection.length) return config;
  const mapped = selection.flatMap(key => mapping[key] ?? []);
  return { ...config, rows: config.rows.filter(row => mapped.includes(row.id)) };
}

/** Checked categories with no calculator row on this occasion — surface honestly, never invent. */
export function uncoveredSelection(selection: string[], mapping: Partial<Record<string, string[]>> = {}): OccasionDrinkId[] {
  return selection.filter(key => !(mapping[key] ?? []).length) as OccasionDrinkId[];
}

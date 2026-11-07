import type { GuideLink } from '@/lib/commercialPages';

/** One topic landing page mounted under /occasions/[occasion]/[subpage]. */
export type SubpageDoc = {
  slug: string;
  title: string;
  heading: string;
  description: string;
  intro: string;
  sections: { heading: string; text: string }[];
  checklist: string[];
  shelves: GuideLink[];
  /** Honest quick facts for the chip strip, derived from this page's own copy. */
  facts?: string[];
};

/**
 * Deterministic planning-tool config. Shares are independent (water can serve
 * every guest while wine serves half) — they are not percentages that must sum
 * to 100. No prices appear anywhere in planning tools; pricing stays on /shop
 * and bottles reach the request list as name + quantity only.
 */
export type CalcRow = {
  id: string;
  label: string;
  /** Drink category label shown in the calculation. */
  category: string;
  /** Initial share of guests this category is planned against (percent). */
  sharePercent: number;
  /** Suggested servings per served guest in the first hour. */
  drinksPerGuest: number;
  /** Extra servings per served guest for each additional hour. Defaults to 1. */
  drinksPerExtraHour?: number;
  /** Usable servings per single bottle of this category. */
  servingsPerBottle: number;
  /** Entry name used when this line is added to the request bottle list. */
  listName: string;
  /** Round the computed bottle count up to multiples of N (e.g. case size). */
  roundTo?: number;
};

export type CalcConfig = {
  heading: string;
  intro: string;
  rows: CalcRow[];
};

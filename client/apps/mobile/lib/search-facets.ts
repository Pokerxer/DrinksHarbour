/**
 * "Why is this bottle on screen?" — provenance facets and the matched-passage
 * snippet shown under a search result.
 *
 * Transcribed from `apps/platform/src/components/Modal/ModalSearch.tsx:225-313`.
 * The backend matches the free-text query against every one of these fields
 * (country, region, appellation, producer, vintage, cask, style, tasting
 * notes), so when a search for "médoc" returns a bottle whose name says
 * neither, this is the line that explains the hit.
 */

import { foldText, matchesTerms } from './search-highlight.ts';

/** Anything the search endpoint returns. Every field is optional. */
type SearchProduct = Record<string, any>;

export interface Facet {
  key: string;
  label: string;
  value: string;
}

/** Enum-ish backend values arrive snake_cased ('stone_fruit', 'full_bodied'). */
export function prettify(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Origin/maturation facts shown under the product name, in the web's order. */
export function getFacets(p: SearchProduct): Facet[] {
  const maker = p.producer || p.wineryName || p.distilleryName || p.breweryName;
  const raw: Array<[string, string, string | number | undefined]> = [
    ['country', 'Country', p.originCountry],
    ['region', 'Region', p.region],
    ['appellation', 'Appellation', p.appellation],
    ['producer', 'Producer', maker],
    ['vintage', 'Vintage', p.vintage],
    ['age', 'Age', p.ageStatement],
    // caskType and style are stored snake_cased ('sherry_cask', 'full_bodied')
    ['cask', 'Cask', p.caskType ? prettify(p.caskType) : undefined],
    ['style', 'Style', p.style ? prettify(p.style) : undefined],
  ];
  return raw
    .filter(([, , value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(([key, label, value]) => ({ key, label, value: String(value) }));
}

const MAX_FACETS = 4;

/**
 * Facets that matched the query come first (they are the reason the product is
 * on screen), then the rest fill the row up to MAX_FACETS.
 */
export function orderFacets(
  facets: Facet[],
  terms: string[]
): { shown: Facet[]; matchedKeys: Set<string> } {
  const matchedKeys = new Set(facets.filter((f) => matchesTerms(f.value, terms)).map((f) => f.key));
  const shown = [
    ...facets.filter((f) => matchedKeys.has(f.key)),
    ...facets.filter((f) => !matchedKeys.has(f.key)),
  ].slice(0, MAX_FACETS);
  return { shown, matchedKeys };
}

const SNIPPET_LENGTH = 120;
const SNIPPET_LEAD = 40;

export function flattenNotes(p: SearchProduct): string {
  const n = p.tastingNotes;
  if (!n) return '';
  return [n.nose, n.aroma, n.palate, n.taste, n.finish, n.mouthfeel]
    .flatMap((v: unknown) => (v ?? []) as string | string[])
    .concat([n.appearance, n.color].filter(Boolean) as string[])
    .join(', ');
}

export interface Snippet {
  label: string;
  text: string;
}

/**
 * When the query hit prose rather than a name or a facet, quote the passage
 * that matched instead of leaving the row looking like an unrelated result.
 */
export function buildSnippet(p: SearchProduct, terms: string[]): Snippet | null {
  const sources: Array<[string, string]> = [
    ['Description', p.shortDescription ?? ''],
    ['Description', p.description ?? ''],
    ['Tasting notes', flattenNotes(p)],
    ['Flavour', ((p.flavorProfile ?? []) as string[]).map(prettify).join(', ')],
  ];

  for (const [label, text] of sources) {
    if (!text) continue;
    // Folded copy for finding, original for quoting — foldText preserves length
    // so the index is valid in both.
    const folded = foldText(text);
    const hit = terms
      .map((t) => folded.indexOf(t))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b)[0];
    if (hit === undefined) continue;

    const start = Math.max(0, hit - SNIPPET_LEAD);
    const end = Math.min(text.length, start + SNIPPET_LENGTH);
    const body = text.slice(start, end).trim();

    return {
      label,
      text: `${start > 0 ? '…' : ''}${body}${end < text.length ? '…' : ''}`,
    };
  }

  return null;
}

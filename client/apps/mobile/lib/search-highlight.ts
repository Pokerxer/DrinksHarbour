/**
 * Accent-insensitive matching and highlighting for search results.
 *
 * Transcribed from `apps/platform/src/components/Modal/ModalSearch.tsx:143-223`
 * rather than reimplemented — this and `search-facets.ts` are exactly where the
 * two apps would otherwise drift, the same reason the pricing modules were
 * transcribed in Phase 3.
 *
 * The server matches "medoc" against "Médoc" (verified live 2026-08-19), so
 * without the same folding rule here a real hit comes back with nothing
 * highlighted and no snippet — the row would look arbitrary.
 */

const ACCENT_CLASSES: Record<string, string> = {
  a: '[aàáâãäåāăą]',
  c: '[cçćĉċč]',
  e: '[eèéêëēĕėęě]',
  i: '[iìíîïĩīĭįı]',
  n: '[nñńņňŉ]',
  o: '[oòóôõöøōŏő]',
  s: '[sśŝşš]',
  u: '[uùúûüũūŭůűų]',
  y: '[yýÿŷ]',
  z: '[zźżž]',
};

// Latin letters incl. the Latin-1 Supplement and Extended-A/B blocks, where
// every accented character in the catalogue lives. Written as explicit ranges
// rather than \p{L} to match the web's ES5 build target exactly.
const LATIN_LETTER = /[A-Za-zÀ-ɏ]/g;
const COMBINING_MARK = /[̀-ͯ]/g;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function foldChar(ch: string): string {
  const base = ch.normalize('NFD').replace(COMBINING_MARK, '').toLowerCase();
  return base.length === 1 ? base : ch.toLowerCase();
}

/**
 * Lowercase and strip accents ONE CHARACTER AT A TIME, so the result is the
 * same length as the input.
 *
 * `buildSnippet` searches the folded copy and slices the ORIGINAL, which only
 * works while the indices line up. `foldChar` falls back to the untouched
 * character whenever a decomposition would not collapse back to one char —
 * that fallback is what preserves the length. Do not "simplify" this to a
 * single `normalize('NFD').replace(...)` over the whole string.
 */
export function foldText(s: string): string {
  return s.replace(LATIN_LETTER, foldChar);
}

/** An accent-insensitive, regex-safe pattern for one term. */
export function toPattern(term: string): string {
  return escapeRe(term).replace(LATIN_LETTER, (ch) => ACCENT_CLASSES[foldChar(ch)] ?? ch);
}

/**
 * The terms worth highlighting: the whole query plus each word of 3+ letters,
 * longest first so the alternation prefers the fullest match ("red wine" over
 * "wine"). Short words are dropped — highlighting every "de" in a French
 * appellation is noise, not signal. All terms come back folded, so compare them
 * against folded text only.
 */
export function queryTerms(query: string): string[] {
  const q = foldText(query.trim());
  if (!q) return [];
  const words = q.split(/\s+/).filter((w) => w.length >= 3);
  return Array.from(new Set([q, ...words])).sort((a, b) => b.length - a.length);
}

export function matchesTerms(value: string | undefined | null, terms: string[]): boolean {
  if (!value) return false;
  const v = foldText(value);
  return terms.some((t) => v.includes(t));
}

export interface HighlightSegment {
  text: string;
  matched: boolean;
}

/**
 * The RN stand-in for the web's `<Highlight>` component. React Native has no
 * `<mark>`, so this returns the runs and the screen maps them onto nested
 * `<Text>` — keeping the rule pure and testable in a `node` environment where
 * no component can be rendered.
 *
 * Segments always reassemble to exactly the input, and matched runs quote the
 * ORIGINAL spelling ("Médoc"), not the folded one.
 */
export function splitHighlight(text: string, query: string): HighlightSegment[] {
  const terms = queryTerms(query);
  if (!terms.length) return text ? [{ text, matched: false }] : [];

  const re = new RegExp(`(${terms.map(toPattern).join('|')})`, 'gi');
  const termSet = new Set(terms);

  return text
    .split(re)
    .filter((part) => part !== '' && part !== undefined)
    .map((part) => ({ text: part, matched: termSet.has(foldText(part)) }));
}

// Shared SEO title capping for every page that renders
// `${title} | DrinksHarbour` as its <title>.
//
// Stored metaTitles (admin-entered or AI-generated at import) very often already
// carry their own "… | DrinksHarbour" tail. Capping one to the SERP budget used
// to cut that tail mid-word and leave a dangling separator, so the page's own
// " | DrinksHarbour" produced titles like
// "Premium French Champagne in Nigeria | | DrinksHarbour".

/** Escape a literal string for use inside a RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Separators a title may be left dangling on after a word-boundary trim. */
const TRAILING_SEPARATORS = /[\s|·•/,:–—-]+$/;

/**
 * Words that cannot end a phrase. A word-boundary trim can land just past one
 * of these — "…Drinks Online in Nigeria" capped to the budget became
 * "…Drinks Online in", which reads as truncated in the SERP.
 */
const TRAILING_STOP_WORDS =
  /\s+(?:in|on|at|for|to|of|by|with|from|and|or|the|a|an|de|is|as|your|our|its|into|onto|per|via)$/i;

/**
 * Drop a "<sep> SiteName" suffix the stored title already carries — the caller
 * appends the site name itself.
 */
export function stripSiteSuffix(raw: string, siteName: string): string {
  return raw
    .replace(new RegExp(`\\s*[|·•/,:–—-]\\s*${escapeRegExp(siteName)}\\s*$`, 'i'), '')
    .trim();
}

/**
 * Cap `raw` so `${result} | ${siteName}` stays within Google's ~60-char SERP
 * display, trimming to a word boundary and never ending on a separator.
 */
export function capSeoTitle(raw: string, siteName: string): string {
  const stripped = stripSiteSuffix(raw, siteName);
  const budget = 60 - ` | ${siteName}`.length;
  if (stripped.length <= budget) return stripped;

  // Trim to a word boundary, then peel off anything the cut left dangling: a
  // separator, a stop word, or a separator the stop word was hiding. Loop
  // because "… Online in |" needs more than one pass.
  let capped = stripped.slice(0, budget).replace(/\s+\S*$/, '');
  for (;;) {
    const next = capped
      .replace(TRAILING_SEPARATORS, '')
      .replace(TRAILING_STOP_WORDS, '');
    if (next === capped) return capped.trim();
    capped = next;
  }
}

/** `${title} | ${siteName}`, with the title capped to the SERP budget. */
export function buildPageTitle(raw: string, siteName: string): string {
  return `${capSeoTitle(raw, siteName)} | ${siteName}`;
}

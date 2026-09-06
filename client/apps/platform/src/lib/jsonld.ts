/**
 * Serialise a JSON-LD object for injection into a <script> element.
 *
 * `JSON.stringify` alone is NOT safe here. It escapes `"` and `\`, but it
 * leaves `<` and `/` untouched — so any string in the object that contains
 * `</script>` closes the script element early and everything after it is parsed
 * as HTML. That is a live XSS sink wherever the object carries anything a user
 * can influence, and on this site it carries two such things:
 *
 *   • URL parameters. /shop falls back to `toTitleCase(params.category)` for
 *     its breadcrumb and collection names whenever the slug misses in the DB,
 *     which puts the raw query string into the document — reflected XSS from a
 *     link alone, no account needed.
 *   • Stored catalogue text. Product names, brand names, descriptions and
 *     stories all reach ItemList/Product schemas, and vendors supply some of it.
 *
 * There is no page-level Content-Security-Policy on this app (the
 * `contentSecurityPolicy` in next.config.js belongs to the `images` block and
 * governs the image optimiser's own responses, not documents), so nothing else
 * stands between an injected `<script>` and execution.
 *
 * The fix is output encoding at the sink. `<` and friends are ordinary
 * JSON escapes: every consumer — Google's parser included — reads them as the
 * original characters, so the emitted structured data is unchanged in meaning.
 * `&` is escaped too, so an entity-decoding context cannot reconstitute a tag,
 * and U+2028/U+2029 because they are literal line terminators to a JavaScript
 * parser while being legal unescaped inside a JSON string.
 *
 * Use this everywhere a JSON-LD object meets `dangerouslySetInnerHTML`. Passing
 * `JSON.stringify` directly is the bug this exists to prevent.
 */
// The escape is computed from the code point rather than looked up in a map of
// literal characters: U+2028 and U+2029 are invisible in an editor and do not
// survive being pasted around, so naming them as source escapes in the regex is
// the only form that stays correct.
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data).replace(
    /[<>&\u2028\u2029]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`
  );
}

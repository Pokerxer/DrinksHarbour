/**
 * Does a typed reply confirm the assistant's cart offer?
 *
 * Transcribed verbatim from `ChatbotWidget.tsx:245-250`. This decision is made
 * LOCALLY and never round-trips: sending a bare "yes" to the model would spend
 * a request to be told what the regex already knows.
 *
 * Both patterns are anchored on purpose. "Sure, but what about the
 * Glenfiddich?" is a question; treating it as a confirmation would add bottles
 * to somebody's cart that they never agreed to.
 */

/** Emoji and punctuation are stripped first, so "Yes please! 🙏" still matches. */
export const normalizeReply = (t: string): string =>
  t.replace(/[^a-zA-Z0-9\s']/g, ' ').replace(/\s+/g, ' ').trim();

const AFFIRMATIVE_RE =
  /^(yes( please)?|yeah|yep|yup|sure|ok(ay)?|oya|go ahead|do it|add (them|it|all|everything)( to (my |the )?cart)?|please( do)?|add to cart|yes add (them|it|all)( to (my |the )?cart)?)$/i;

const NEGATIVE_RE = /^(no( thanks?| thank you)?|nope|nah|not now|don'?t|later|maybe later)$/i;

export const isAffirmative = (t: string): boolean => AFFIRMATIVE_RE.test(normalizeReply(t));

export const isNegative = (t: string): boolean => NEGATIVE_RE.test(normalizeReply(t));

import { describe, expect, test } from 'vitest';
import { isAffirmative, isNegative, normalizeReply } from './chat-replies.ts';

/**
 * Transcribed verbatim from `ChatbotWidget.tsx:245-250`.
 *
 * These decide, LOCALLY, whether a typed "yes" confirms the assistant's cart
 * offer. Nothing round-trips: a stricter matcher would send "yes" to the model
 * and add nothing, a looser one would add bottles to somebody's cart because
 * they wrote a sentence containing the word "sure".
 */

describe('normalizeReply', () => {
  test('strips emoji and punctuation so "Yes please! 🙏" still matches', () => {
    expect(normalizeReply('Yes please! 🙏')).toBe('Yes please');
  });

  test('collapses whitespace', () => {
    expect(normalizeReply('  go   ahead  ')).toBe('go ahead');
  });

  test('keeps the apostrophe "don\'t" needs', () => {
    expect(normalizeReply("don't")).toBe("don't");
  });
});

describe('isAffirmative', () => {
  test('accepts the plain yeses', () => {
    for (const t of ['yes', 'Yes', 'yeah', 'yep', 'yup', 'sure', 'ok', 'okay', 'oya']) {
      expect(isAffirmative(t)).toBe(true);
    }
  });

  test('accepts the explicit add-to-cart phrasings', () => {
    for (const t of [
      'go ahead',
      'do it',
      'add to cart',
      'add them to my cart',
      'add everything',
      'yes add all to the cart',
      'please do',
      'Yes please! 🙏',
    ]) {
      expect(isAffirmative(t)).toBe(true);
    }
  });

  test('REJECTS a sentence that merely contains a yes', () => {
    // This is the whole point of anchoring the pattern. "Sure, but what about
    // the Glenfiddich?" is a question, not a confirmation, and treating it as
    // one would silently charge somebody for bottles they did not ask for.
    for (const t of [
      'sure, but what about the Glenfiddich?',
      'yes if it is under 50k',
      'ok so which one is smokier',
      'do it later',
    ]) {
      expect(isAffirmative(t)).toBe(false);
    }
  });

  test('an empty reply is not a confirmation', () => {
    expect(isAffirmative('')).toBe(false);
    expect(isAffirmative('   ')).toBe(false);
  });
});

describe('isNegative', () => {
  test('accepts the plain noes', () => {
    for (const t of ['no', 'No thanks', 'no thank you', 'nope', 'nah', 'not now', "don't", 'later', 'maybe later']) {
      expect(isNegative(t)).toBe(true);
    }
  });

  test('REJECTS a sentence that merely contains a no', () => {
    expect(isNegative('no, show me something cheaper')).toBe(false);
  });

  test('a yes is not a no', () => {
    expect(isNegative('yes')).toBe(false);
  });
});

describe('the two are mutually exclusive', () => {
  test('nothing is both', () => {
    for (const t of ['yes', 'no', 'sure', 'nah', 'add to cart', 'maybe later', 'what?']) {
      expect(isAffirmative(t) && isNegative(t)).toBe(false);
    }
  });
});

import { describe, expect, it } from 'vitest';
import {
  BUCKET_META,
  cartLineKey,
  formatAge,
  formatJoined,
  isFollowUpWorthy,
  lineSummary,
  signupSummary,
} from './cart-meta';

describe('formatAge', () => {
  it('reads "just now" under an hour rather than "0h"', () => {
    expect(formatAge(0)).toBe('just now');
    expect(formatAge(0.4)).toBe('just now');
  });

  it('uses hours below a day', () => {
    expect(formatAge(1)).toBe('1h');
    expect(formatAge(23)).toBe('23h');
  });

  it('rolls into days, weeks, then months', () => {
    expect(formatAge(24)).toBe('1d');
    expect(formatAge(24 * 6)).toBe('6d');
    expect(formatAge(24 * 7)).toBe('1w');
    expect(formatAge(24 * 28)).toBe('4w');
    expect(formatAge(24 * 60)).toBe('2mo');
  });

  it('never renders NaN or a negative age', () => {
    expect(formatAge(NaN)).toBe('—');
    expect(formatAge(-5)).toBe('—');
    expect(formatAge(Infinity)).toBe('—');
  });
});

describe('lineSummary', () => {
  it('singularises one item and one unit', () => {
    expect(lineSummary(1, 1, 0)).toBe('1 item · 1 unit');
  });

  it('pluralises everything else', () => {
    expect(lineSummary(3, 7, 0)).toBe('3 items · 7 units');
  });

  it('appends the other-tenant count only when there is one', () => {
    expect(lineSummary(2, 4, 0)).toBe('2 items · 4 units');
    expect(lineSummary(2, 4, 1)).toBe('2 items · 4 units · 1 from other store');
    expect(lineSummary(2, 4, 3)).toBe(
      '2 items · 4 units · 3 from other stores'
    );
  });
});

describe('isFollowUpWorthy', () => {
  it('is false for a cart the shopper is still using', () => {
    expect(isFollowUpWorthy('active', 50000)).toBe(false);
  });

  it('is true for a stale cart that still has value', () => {
    expect(isFollowUpWorthy('at_risk', 50000)).toBe(true);
    expect(isFollowUpWorthy('abandoned', 1)).toBe(true);
  });

  it('is false for a stale cart worth nothing to this tenant', () => {
    // Every visible line was priced at 0 — chasing it wins no revenue.
    expect(isFollowUpWorthy('abandoned', 0)).toBe(false);
  });
});

describe('BUCKET_META', () => {
  it('covers every bucket the server can return', () => {
    expect(Object.keys(BUCKET_META).sort()).toEqual([
      'abandoned',
      'active',
      'at_risk',
    ]);
  });
});

describe('cartLineKey', () => {
  // The crash this fixes: two cart lines sharing a subproduct and size but
  // differing in `product`. addToCart merges on all THREE, so the cart treats
  // these as distinct and React saw one duplicated key.
  it('separates lines that share a subproduct and size but differ in product', () => {
    const a = { productId: 'p1', subProductId: 's1', sizeId: 'z1' };
    const b = { productId: 'p2', subProductId: 's1', sizeId: 'z1' };
    expect(cartLineKey(a, 0)).not.toBe(cartLineKey(b, 1));
  });

  it('stays unique even for two byte-identical lines', () => {
    // replaceCart writes items without addToCart's merge, so the identity
    // triple is not guaranteed unique either — the index is the backstop.
    const line = { productId: 'p1', subProductId: 's1', sizeId: 'z1' };
    expect(cartLineKey(line, 0)).not.toBe(cartLineKey(line, 1));
  });

  it('is stable for the same line at the same position', () => {
    const line = { productId: 'p1', subProductId: 's1', sizeId: 'z1' };
    expect(cartLineKey(line, 2)).toBe(cartLineKey({ ...line }, 2));
  });

  it('does not collide when optional fields are missing', () => {
    // '' for a missing field must not let ('a', undefined) and (undefined, 'a')
    // flatten onto the same string — hence a separator that cannot appear in
    // an ObjectId.
    expect(cartLineKey({ subProductId: 'a' }, 0)).not.toBe(
      cartLineKey({ sizeId: 'a' }, 0)
    );
    // product | subproduct | size | index — four parts, three separators.
    expect(cartLineKey({}, 0)).toBe('|||0');
  });
});

describe('signupSummary', () => {
  it('reads "No cart yet"', () => {
    expect(signupSummary()).toBe('No cart yet');
  });
});

describe('formatJoined', () => {
  it('formats a valid ISO timestamp', () => {
    expect(formatJoined('2026-08-14T17:25:47.573Z')).toMatch(/14 Aug|Aug 14/);
  });

  it('renders a dash for a missing or invalid date', () => {
    expect(formatJoined(undefined)).toBe('—');
    expect(formatJoined('not-a-date')).toBe('—');
  });
});

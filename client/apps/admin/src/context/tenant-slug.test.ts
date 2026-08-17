import { describe, it, expect } from 'vitest';
import { resolveTenantSlug } from './tenant-slug';

describe('resolveTenantSlug', () => {
  it('uses the subdomain when the URL names a tenant', () => {
    expect(
      resolveTenantSlug({ hostSlug: 'wyncity', sessionTenantSlug: null })
    ).toBe('wyncity');
  });

  it("falls back to the signed-in user's own tenant on the admin domain", () => {
    expect(
      resolveTenantSlug({ hostSlug: null, sessionTenantSlug: 'wyncity' })
    ).toBe('wyncity');
  });

  // A platform admin owns no tenant, so there is genuinely nothing to brand as.
  it('resolves to nothing when neither names a tenant', () => {
    expect(
      resolveTenantSlug({ hostSlug: null, sessionTenantSlug: null })
    ).toBeNull();
  });

  // The subdomain is how a platform admin pivots into one tenant. A tenant user
  // on somebody else's subdomain never reaches this — middleware redirects them
  // to /access-denied before a page renders.
  it('lets the subdomain win over the session when they disagree', () => {
    expect(
      resolveTenantSlug({ hostSlug: 'acme', sessionTenantSlug: 'wyncity' })
    ).toBe('acme');
  });

  it('treats blank and whitespace-only values as absent', () => {
    expect(
      resolveTenantSlug({ hostSlug: '   ', sessionTenantSlug: 'wyncity' })
    ).toBe('wyncity');
    expect(
      resolveTenantSlug({ hostSlug: '', sessionTenantSlug: '' })
    ).toBeNull();
    expect(
      resolveTenantSlug({ hostSlug: undefined, sessionTenantSlug: undefined })
    ).toBeNull();
  });

  it('trims a padded slug rather than looking it up with the padding', () => {
    expect(
      resolveTenantSlug({ hostSlug: null, sessionTenantSlug: ' wyncity ' })
    ).toBe('wyncity');
  });
});

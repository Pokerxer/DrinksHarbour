import { describe, expect, it } from 'vitest';
import {
  TENANT_PRIVATE_IDENTITY_LABEL,
  TENANT_PRIVATE_IDENTITY_NOTE,
  TENANT_PRIVATE_MATCH_NOTE,
  isTenantPrivateProduct,
} from './catalogue-scope';

describe('tenant-private central product detection', () => {
  it('stays silent for legacy rows with no publicationScope field', () => {
    expect(isTenantPrivateProduct(undefined)).toBe(false);
    expect(isTenantPrivateProduct(null)).toBe(false);
    expect(isTenantPrivateProduct({})).toBe(false);
  });
  it('treats canonical (or unknown) scopes as not private', () => {
    expect(isTenantPrivateProduct({ publicationScope: 'canonical' })).toBe(false);
    expect(isTenantPrivateProduct({ publicationScope: 'future-scope' })).toBe(false);
  });
  it('recognizes only the explicit private scope', () => {
    expect(isTenantPrivateProduct({ publicationScope: 'tenant_private' })).toBe(true);
  });
});

describe('tenant-private copy', () => {
  it('frames private identity around sellability, not unavailability', () => {
    expect(TENANT_PRIVATE_IDENTITY_LABEL).toBe('Private identity');
    expect(TENANT_PRIVATE_IDENTITY_NOTE.toLowerCase()).toContain('sellable');
    expect(TENANT_PRIVATE_IDENTITY_NOTE.toLowerCase()).toContain('review');
  });
  it('describes the matched identity for the picker without owner identifiers', () => {
    expect(TENANT_PRIVATE_MATCH_NOTE.toLowerCase()).toContain('sellable');
    expect(TENANT_PRIVATE_MATCH_NOTE).not.toContain('owningTenant');
  });
});

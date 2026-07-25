import { describe, expect, test } from 'vitest';
import { hasAdminSession } from './session-guard';

/**
 * The middleware's only gate used to be `!!token`, which admits any session
 * NextAuth can mint — including one carrying no role and no backend access
 * token. Holding such a token, a stranger reached the admin shell; only the
 * sections that explicitly check PLATFORM_ROLES turned them away.
 */
describe('hasAdminSession', () => {
  test('denies a missing token', () => {
    expect(hasAdminSession(null)).toBe(false);
    expect(hasAdminSession(undefined)).toBe(false);
  });

  test('denies a token with no role', () => {
    // Previously this fell back to 'viewer' — a role that exists in no
    // permission table, so it was silently treated as "not a tenant role".
    expect(hasAdminSession({ accessToken: 'access-token' })).toBe(false);
  });

  test('denies a storefront customer', () => {
    expect(
      hasAdminSession({ role: 'customer', accessToken: 'access-token' })
    ).toBe(false);
  });

  test('denies an unrecognised role', () => {
    expect(
      hasAdminSession({ role: 'viewer', accessToken: 'access-token' })
    ).toBe(false);
  });

  test('denies a recognised role holding no backend access token', () => {
    // A session with no access token cannot talk to the API at all; every page
    // it opens is a broken shell, and it is the shape an OAuth-minted session
    // would have had.
    expect(hasAdminSession({ role: 'admin' })).toBe(false);
    expect(hasAdminSession({ role: 'admin', accessToken: '' })).toBe(false);
  });

  test.each([
    'super_admin',
    'admin',
    'tenant_admin',
    'tenant_owner',
    'tenant_staff',
  ])('admits %s with an access token', (role) => {
    expect(hasAdminSession({ role, accessToken: 'access-token' })).toBe(true);
  });
});

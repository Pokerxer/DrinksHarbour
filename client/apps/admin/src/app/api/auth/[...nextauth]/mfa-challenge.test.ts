import { describe, expect, test } from 'vitest';
import { MFA_REQUIRED_PREFIX, parseMfaChallenge } from './mfa-challenge';

/**
 * `authorize` cannot return a partial session, so the MFA hand-off travels as a
 * thrown message that NextAuth surfaces on `result.error`. The sign-in form and
 * the provider must agree on that encoding, so both import it from here.
 */
describe('parseMfaChallenge', () => {
  test('extracts the pending token from a challenge error', () => {
    expect(parseMfaChallenge(`${MFA_REQUIRED_PREFIX}pending-token-123`)).toBe(
      'pending-token-123'
    );
  });

  test('returns null for an ordinary auth error', () => {
    expect(parseMfaChallenge('Invalid email or password')).toBeNull();
  });

  test('returns null for a missing error', () => {
    expect(parseMfaChallenge(undefined)).toBeNull();
    expect(parseMfaChallenge(null)).toBeNull();
  });

  test('returns null when the prefix carries no token', () => {
    expect(parseMfaChallenge(MFA_REQUIRED_PREFIX)).toBeNull();
  });

  test('keeps a JWT intact — dots and dashes are not separators', () => {
    const jwt = 'aa.bb-cc_dd.ee';
    expect(parseMfaChallenge(`${MFA_REQUIRED_PREFIX}${jwt}`)).toBe(jwt);
  });
});

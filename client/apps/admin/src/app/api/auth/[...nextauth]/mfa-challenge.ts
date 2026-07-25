/**
 * Encoding for the MFA hand-off between `authorize` and the sign-in form.
 *
 * `authorize` can only return a user or throw, and a half-authenticated user is
 * not a session — so the pending token travels as a thrown message, which
 * NextAuth surfaces to the client on `result.error`.
 *
 * This module is imported by both the server-side provider and the client-side
 * sign-in form, so it must stay free of server-only imports.
 */
export const MFA_REQUIRED_PREFIX = 'MFA_REQUIRED::';

/**
 * @returns the pending-MFA token if `error` is an MFA challenge, else null.
 */
export function parseMfaChallenge(
  error: string | null | undefined
): string | null {
  if (!error || !error.startsWith(MFA_REQUIRED_PREFIX)) return null;
  const token = error.slice(MFA_REQUIRED_PREFIX.length);
  return token.length > 0 ? token : null;
}

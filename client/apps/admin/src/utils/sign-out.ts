import { signOut } from 'next-auth/react';

/**
 * Sign out of the admin dashboard, revoking the backend refresh token first.
 *
 * A bare `signOut()` only drops the local NextAuth cookie; the refresh token
 * stays usable server-side until it expires on its own. The revoke call is
 * best-effort — a network failure must not strand the user in a session they
 * asked to end.
 */
export async function signOutAndRevoke(
  options?: Parameters<typeof signOut>[0]
): Promise<void> {
  try {
    await fetch('/api/auth/revoke', { method: 'POST' });
  } catch (error) {
    console.error('Sign-out revocation failed; signing out locally:', error);
  }

  await signOut(options);
}

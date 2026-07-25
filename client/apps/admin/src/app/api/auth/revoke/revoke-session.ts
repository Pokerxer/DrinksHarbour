const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

/**
 * Revoke the backend refresh token behind the current session.
 *
 * POST /api/users/logout is `protect`ed, so it needs the access token, and it
 * revokes by the refresh token's jti, so it needs the refresh token in the
 * body — this admin app never receives the backend's own auth cookies, since
 * login happens server-side inside NextAuth's `authorize`.
 *
 * Never throws: sign-out must proceed regardless of what the backend says.
 */
export async function revokeBackendSession(
  accessToken: string | undefined,
  refreshToken: string | undefined
): Promise<boolean> {
  if (!accessToken) return false;

  try {
    const response = await fetch(`${API_URL}/api/users/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ refreshToken }),
    });
    return response.ok;
  } catch (error) {
    console.error('Failed to revoke backend session on sign-out:', error);
    return false;
  }
}

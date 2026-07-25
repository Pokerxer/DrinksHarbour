import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { revokeBackendSession } from './revoke-session';

/**
 * Server-side half of sign-out: read the backend tokens out of the encrypted
 * NextAuth JWT and ask the API to revoke the refresh token.
 *
 * This lives on the server precisely so the refresh token never has to be
 * exposed to the browser in order to be revoked.
 */
export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  const revoked = await revokeBackendSession(
    token?.accessToken as string | undefined,
    token?.refreshToken as string | undefined
  );

  // Always 200: the client signs out locally either way, and the caller has no
  // useful decision to make on a failed revocation.
  return NextResponse.json({ revoked });
}

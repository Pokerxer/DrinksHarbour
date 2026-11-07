import { getServerSession } from 'next-auth/next';
import { UploadThingError } from 'uploadthing/server';
import { z } from 'zod';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { ADMIN_ACCESS_ROLES, PLATFORM_ROLES, type UserRole } from '@/types/authorization';

const profileResponse = z.object({
  success: z.literal(true),
  data: z.object({
    _id: z.string().min(1),
    role: z.string().refine((role) => ADMIN_ACCESS_ROLES.includes(role as UserRole)),
    status: z.literal('active'),
    tenant: z.union([
      z.string().min(1), z.object({ _id: z.string().min(1) }),
    ]).nullish(),
  }),
});

/** Recheck token validity and account state; session role/tenant hints may be stale. */
export async function authorizeUpload() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.token || ('error' in session && session.error)) {
      throw new Error('Invalid session');
    }
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
    const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/users/me`, {
      headers: { Authorization: `Bearer ${session.user.token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('Invalid access token');
    const { data: user } = profileResponse.parse(await response.json());
    const tenantId = typeof user.tenant === 'string' ? user.tenant : user.tenant?._id ?? null;
    if (user._id !== session.user.id ||
      (!tenantId && !PLATFORM_ROLES.includes(user.role as UserRole))) {
      throw new Error('Invalid identity');
    }
    return { userId: user._id, tenantId };
  } catch {
    // Do not expose tokens, backend responses or account details to the caller.
    throw new UploadThingError({ code: 'FORBIDDEN', message: 'Unauthorized' });
  }
}

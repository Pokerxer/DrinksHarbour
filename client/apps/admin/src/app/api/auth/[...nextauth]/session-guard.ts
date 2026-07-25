import { ADMIN_ACCESS_ROLES, type UserRole } from '@/types/authorization';

interface GuardedToken {
  role?: unknown;
  accessToken?: unknown;
}

/**
 * Whether a decoded NextAuth token may enter the admin dashboard at all.
 *
 * Two conditions, both necessary:
 *  - a role on the admin whitelist, so an absent or unrecognised role denies
 *    rather than inheriting the permissions of a role that does not exist;
 *  - a backend access token, without which every API call the page makes 401s.
 *
 * Per-section role rules still apply on top of this; it is the floor.
 */
export function hasAdminSession(
  token: GuardedToken | null | undefined
): boolean {
  if (!token) return false;

  const role = token.role;
  if (typeof role !== 'string') return false;
  if (!ADMIN_ACCESS_ROLES.includes(role as UserRole)) return false;

  return typeof token.accessToken === 'string' && token.accessToken.length > 0;
}

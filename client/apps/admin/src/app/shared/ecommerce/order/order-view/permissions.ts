'use client';

import { useSession } from 'next-auth/react';

/** Roles allowed to mutate order status/payment. Mirrors the server-side guard
 *  (order controllers) — tenant_staff see the page read-only instead of 403s.
 *  Single source of truth: previously duplicated in StatusStepper and
 *  PaymentPanel with a hardcoded inline array each. */
export const ORDER_MANAGER_ROLES = [
  'super_admin',
  'admin',
  'tenant_admin',
  'tenant_owner',
] as const;

export function useOrderSession() {
  const { data: session, status } = useSession();
  const user = session?.user as { token?: string; role?: string } | undefined;
  return {
    /** JWT for API calls — undefined until the session hydrates. */
    token: user?.token,
    canManage: ORDER_MANAGER_ROLES.includes(
      (user?.role ?? '') as (typeof ORDER_MANAGER_ROLES)[number]
    ),
    status,
  };
}

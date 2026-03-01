'use client';

import { useSession } from 'next-auth/react';
import {
  type UserRole,
  type Permission,
  ROLE_PERMISSIONS,
  isPlatformRole,
  isTenantRole,
} from '@/types/authorization';
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  canAccessTenant,
  isPlatformAdmin,
  isTenantAdmin,
} from '@/utils/authorization';

export interface AuthorizedUser {
  id: string;
  email: string | null;
  name: string | null;
  role: UserRole;
  tenantId?: string | null;
  token?: string;
}

export function useAuthorization() {
  const { data: session, status } = useSession();

  const user = session?.user as AuthorizedUser | undefined;
  const isLoading = status === 'loading';
  const isAuthenticated = status === 'authenticated';

  const role = (user?.role as UserRole) ?? 'viewer';
  const tenantId = user?.tenantId ?? null;

  const checkPermission = (permission: Permission): boolean => {
    if (!isAuthenticated) return false;
    return hasPermission(role, permission);
  };

  const checkAnyPermission = (permissions: Permission[]): boolean => {
    if (!isAuthenticated) return false;
    return hasAnyPermission(role, permissions);
  };

  const checkAllPermissions = (permissions: Permission[]): boolean => {
    if (!isAuthenticated) return false;
    return hasAllPermissions(role, permissions);
  };

  const checkTenantAccess = (targetTenantId: string): boolean => {
    if (!isAuthenticated) return false;
    return canAccessTenant(role, tenantId, targetTenantId);
  };

  const isAdmin = isPlatformAdmin(role);
  const isTenantUser = isTenantRole(role);
  const isTenantAdminUser = isTenantAdmin(role);

  return {
    user,
    role,
    tenantId,
    isLoading,
    isAuthenticated,
    isAdmin,
    isTenantUser,
    isTenantAdminUser,
    checkPermission,
    checkAnyPermission,
    checkAllPermissions,
    checkTenantAccess,
    permissions: ROLE_PERMISSIONS[role] ?? [],
  };
}

export function usePermission(permission: Permission): boolean {
  const { checkPermission, isAuthenticated, isLoading } = useAuthorization();
  
  if (isLoading) return false;
  return checkPermission(permission);
}

export function useAnyPermission(permissions: Permission[]): boolean {
  const { checkAnyPermission, isAuthenticated, isLoading } = useAuthorization();
  
  if (isLoading) return false;
  return checkAnyPermission(permissions);
}

export function useTenantAccess(targetTenantId: string): boolean {
  const { checkTenantAccess, isAuthenticated, isLoading } = useAuthorization();
  
  if (isLoading) return false;
  return checkTenantAccess(targetTenantId);
}

export function useAuthToken(): string | undefined {
  const { data: session } = useSession();
  return session?.user?.token;
}

export function useTenantId(): string | null {
  const { data: session } = useSession();
  return session?.user?.tenantId ?? null;
}

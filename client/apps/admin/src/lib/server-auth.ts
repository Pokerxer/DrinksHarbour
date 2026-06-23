import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
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
  canAccessTenant,
  isPlatformAdmin,
} from '@/utils/authorization';

export interface AuthorizedServerUser {
  id: string;
  email: string | null;
  name: string | null;
  role: UserRole;
  tenantId?: string | null;
  token?: string;
}

export interface AuthResult {
  user: AuthorizedServerUser | null;
  isAuthorized: boolean;
  error?: string;
}

export async function getAuthenticatedUser(): Promise<AuthorizedServerUser | null> {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return null;
  }

  return session.user as AuthorizedServerUser;
}

export async function requireAuth(): Promise<AuthResult> {
  const user = await getAuthenticatedUser();
  
  if (!user) {
    return {
      user: null,
      isAuthorized: false,
      error: 'Authentication required',
    };
  }

  return {
    user,
    isAuthorized: true,
  };
}

export async function requirePermission(permission: Permission): Promise<AuthResult> {
  const authResult = await requireAuth();
  
  if (!authResult.isAuthorized) {
    return authResult;
  }

  const hasAccess = hasPermission(authResult.user!.role, permission);
  
  if (!hasAccess) {
    return {
      user: authResult.user,
      isAuthorized: false,
      error: `Permission denied: ${permission} required`,
    };
  }

  return authResult;
}

export async function requireAnyPermission(
  permissions: Permission[]
): Promise<AuthResult> {
  const authResult = await requireAuth();
  
  if (!authResult.isAuthorized) {
    return authResult;
  }

  const hasAccess = hasAnyPermission(authResult.user!.role, permissions);
  
  if (!hasAccess) {
    return {
      user: authResult.user,
      isAuthorized: false,
      error: `Permission denied: one of [${permissions.join(', ')}] required`,
    };
  }

  return authResult;
}

export async function requireTenantAccess(
  targetTenantId: string
): Promise<AuthResult> {
  const authResult = await requireAuth();
  
  if (!authResult.isAuthorized) {
    return authResult;
  }

  const user = authResult.user!;
  
  if (isPlatformRole(user.role)) {
    return authResult;
  }

  const hasAccess = canAccessTenant(user.role, user.tenantId, targetTenantId);
  
  if (!hasAccess) {
    return {
      user,
      isAuthorized: false,
      error: 'Access denied to this tenant',
    };
  }

  return authResult;
}

export async function requirePlatformAdmin(): Promise<AuthResult> {
  const authResult = await requireAuth();
  
  if (!authResult.isAuthorized) {
    return authResult;
  }

  const isAdmin = isPlatformAdmin(authResult.user!.role);
  
  if (!isAdmin) {
    return {
      user: authResult.user,
      isAuthorized: false,
      error: 'Platform admin access required',
    };
  }

  return authResult;
}

export async function requireTenantAdmin(): Promise<AuthResult> {
  const authResult = await requireAuth();
  
  if (!authResult.isAuthorized) {
    return authResult;
  }

  const role = authResult.user!.role;
  const isAdmin = isPlatformAdmin(role) || role === 'tenant_admin' || role === 'tenant_owner';
  
  if (!isAdmin) {
    return {
      user: authResult.user,
      isAuthorized: false,
      error: 'Tenant admin access required',
    };
  }

  return authResult;
}

export function getUserPermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function getAuthToken(): string | undefined {
  return undefined;
}

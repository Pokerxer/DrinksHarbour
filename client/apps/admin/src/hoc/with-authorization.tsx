'use client';

import { useAuthorization } from '@/hooks/use-authorization';
import type { Permission } from '@/types/authorization';

interface WithAuthorizationOptions {
  permission?: Permission;
  permissions?: Permission[];
  requireAny?: boolean;
  fallback?: React.ReactNode;
  loadingFallback?: React.ReactNode;
}

export function withAuthorization<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: WithAuthorizationOptions
) {
  const { permission, permissions, requireAny = false, fallback = null, loadingFallback = null } = options;

  function WithAuthorizationComponent(props: P) {
    const { isLoading, isAuthenticated, checkPermission, checkAnyPermission, checkAllPermissions } = useAuthorization();

    if (isLoading) {
      return <>{loadingFallback}</>;
    }

    if (!isAuthenticated) {
      return <>{fallback}</>;
    }

    let hasAccess = false;

    if (permission) {
      hasAccess = checkPermission(permission);
    } else if (permissions) {
      hasAccess = requireAny
        ? checkAnyPermission(permissions)
        : checkAllPermissions(permissions);
    }

    if (!hasAccess) {
      return <>{fallback}</>;
    }

    return <WrappedComponent {...props} />;
  }

  WithAuthorizationComponent.displayName = `WithAuthorization(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return WithAuthorizationComponent;
}

export function useRequireAuth() {
  const { isAuthenticated, isLoading } = useAuthorization();
  return { isAuthenticated, isLoading };
}

import { useCallback } from 'react';
import { useSession } from 'next-auth/react';
import type { UserRole } from '@/types/authorization';

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  tenantId: string | null;
  token: string;
  image?: string | null;
}

export interface UseApiCallOptions {
  /** super_admin/admin cross-tenant pivot only — the backend resolves it via
   *  x-tenant-slug. Omit to operate on the caller's own tenant. */
  tenantSlug?: string;
}

interface ApiResponse {
  success: boolean;
  message?: string;
  data?: unknown;
}

export function useApiClient() {
  const { data: session, status } = useSession();

  const user = session?.user as AuthUser | undefined;
  const token = user?.token;
  const tenantId = user?.tenantId ?? undefined;
  const role = user?.role;
  const isLoading = status === 'loading';
  const isAuthenticated = status === 'authenticated';

  const apiCall = useCallback(
    async <T = unknown>(
      url: string,
      options: RequestInit & { tenantSlug?: string } = {}
    ): Promise<T> => {
      if (!token) {
        throw new Error('Not authenticated');
      }

      const { tenantSlug, ...fetchOptions } = options;

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      // The caller's own tenant is never sent: the server derives it from the JWT
      // claim (requireOwnTenant) and ignores any client-supplied tenant id, so
      // sending one bought nothing and cost us the CORS preflight — `x-tenant-id`
      // is not in the backend's allowedHeaders, which surfaced as "Failed to
      // fetch". Only the deliberate super_admin/admin cross-tenant pivot sets a
      // header, and it uses the slug the backend actually reads.
      if (tenantSlug) {
        headers['x-tenant-slug'] = tenantSlug;
      }

      const response = await fetch(url, {
        ...fetchOptions,
        headers: {
          ...headers,
          ...fetchOptions.headers,
        },
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Request failed');
      }

      return data.data as T;
    },
    [token]
  );

  return {
    user,
    token,
    tenantId,
    role,
    isLoading,
    isAuthenticated,
    apiCall,
  };
}

export function useAuthenticatedFetch() {
  const { apiCall, isAuthenticated, isLoading } = useApiClient();

  const get = useCallback(
    async <T = unknown>(url: string, options?: RequestInit) =>
      apiCall<T>(url, { ...options, method: 'GET' }),
    [apiCall]
  );

  const post = useCallback(
    async <T = unknown>(url: string, body?: unknown, options?: RequestInit) =>
      apiCall<T>(url, {
        ...options,
        method: 'POST',
        body: JSON.stringify(body),
      }),
    [apiCall]
  );

  const put = useCallback(
    async <T = unknown>(url: string, body?: unknown, options?: RequestInit) =>
      apiCall<T>(url, {
        ...options,
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    [apiCall]
  );

  const patch = useCallback(
    async <T = unknown>(url: string, body?: unknown, options?: RequestInit) =>
      apiCall<T>(url, {
        ...options,
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    [apiCall]
  );

  const del = useCallback(
    async <T = unknown>(url: string, options?: RequestInit) =>
      apiCall<T>(url, { ...options, method: 'DELETE' }),
    [apiCall]
  );

  return {
    get,
    post,
    put,
    patch,
    delete: del,
    isAuthenticated,
    isLoading,
  };
}

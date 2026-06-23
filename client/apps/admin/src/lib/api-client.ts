import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function getAuthHeaders(tenantId?: string): Promise<HeadersInit> {
  const session = await getServerSession(authOptions);
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (session?.user?.token) {
    headers['Authorization'] = `Bearer ${session.user.token}`;
  }

  if (tenantId) {
    headers['X-Tenant-Id'] = tenantId;
  }

  return headers;
}

interface ApiClientResponse {
  success: boolean;
  message?: string;
  data?: unknown;
}

export async function apiClient<T = unknown>(
  endpoint: string,
  options: RequestInit & { tenantId?: string } = {}
): Promise<T> {
  const { tenantId, ...fetchOptions } = options;
  const headers = await getAuthHeaders(tenantId);
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOptions,
    headers: {
      ...headers,
      ...fetchOptions.headers,
    },
  });

  const data = await response.json() as ApiClientResponse;

  if (!response.ok || !data.success) {
    throw new ApiError(
      response.status,
      data.message || 'An error occurred'
    );
  }

  return data.data as T;
}

export const api = {
  get: <T = any>(endpoint: string, options?: { tenantId?: string }) =>
    apiClient<T>(endpoint, { method: 'GET', ...options }),

  post: <T = any>(endpoint: string, body?: any, options?: { tenantId?: string }) =>
    apiClient<T>(endpoint, { method: 'POST', body: JSON.stringify(body), ...options }),

  put: <T = any>(endpoint: string, body?: any, options?: { tenantId?: string }) =>
    apiClient<T>(endpoint, { method: 'PUT', body: JSON.stringify(body), ...options }),

  patch: <T = any>(endpoint: string, body?: any, options?: { tenantId?: string }) =>
    apiClient<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body), ...options }),

  delete: <T = any>(endpoint: string, options?: { tenantId?: string }) =>
    apiClient<T>(endpoint, { method: 'DELETE', ...options }),
};

export { API_URL };

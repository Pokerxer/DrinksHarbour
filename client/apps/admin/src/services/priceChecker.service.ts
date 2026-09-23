import type {
  Kiosk,
  KioskInput,
  KioskOptions,
  KioskAnalytics,
} from '@/app/shared/price-checker/types';
const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001').replace(/\/$/, '');
async function request<T>(
  path: string,
  token: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(`${API}/api/price-checker${path}`, {
    method,
    signal,
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const result = (await response.json()) as { success?: boolean; message?: string; data: T };
  if (!response.ok || !result.success)
    throw new Error(result.message || 'Unable to load price checker.');
  return result.data as T;
}
export const priceCheckerApi = {
  list: (token: string, signal?: AbortSignal) =>
    request<Kiosk[]>('/kiosks', token, 'GET', undefined, signal),
  get: (id: string, token: string) => request<Kiosk>(`/kiosks/${id}`, token),
  options: (token: string, signal?: AbortSignal) => request<KioskOptions>('/options', token, 'GET', undefined, signal),
  create: (data: KioskInput, token: string) => request<Kiosk>('/kiosks', token, 'POST', data),
  update: (id: string, data: Partial<KioskInput>, token: string) =>
    request<Kiosk>(`/kiosks/${id}`, token, 'PATCH', data),
  remove: (id: string, token: string) => request<void>(`/kiosks/${id}`, token, 'DELETE'),
  analytics: (query: Record<string, string>, token: string, signal?: AbortSignal) =>
    request<KioskAnalytics>(
      `/analytics?${new URLSearchParams(query)}`,
      token,
      'GET',
      undefined,
      signal
    ),
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

async function req<T = any>(
  url: string,
  token: string,
  opts: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_URL}${url}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  const body = (await res.json()) as T & {
    success?: boolean;
    message?: string;
    errors?: Record<string, string>;
  };
  if (!res.ok || !body.success) {
    const err = new Error(body.message || 'Request failed');
    // Attach the full body so callers can surface field-keyed validation errors
    // (e.g. the rule modal maps body.errors to per-field error displays).
    (err as any).body = body;
    throw err;
  }
  return body as T;
}

export interface PricelistListResponse {
  data: { pricelists: any[]; total: number };
}

export const pricelistService = {
  list: (token: string, params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return req<PricelistListResponse>(`/api/pricelists${qs}`, token);
  },
  get: (id: string, token: string) => req<{ data: any }>(`/api/pricelists/${id}`, token),
  create: (data: any, token: string) =>
    req<{ data: any }>('/api/pricelists', token, { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any, token: string) =>
    req<{ data: any }>(`/api/pricelists/${id}`, token, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string, token: string) =>
    req<{ data: any }>(`/api/pricelists/${id}`, token, { method: 'DELETE' }),
  apply: (id: string, token: string) =>
    req<{ data: any }>(`/api/pricelists/${id}/apply`, token, { method: 'POST' }),

  addRule: (id: string, rule: any, token: string) =>
    req<{ data: any }>(`/api/pricelists/${id}/rules`, token, { method: 'POST', body: JSON.stringify(rule) }),
  updateRule: (id: string, ruleId: string, rule: any, token: string) =>
    req<{ data: any }>(`/api/pricelists/${id}/rules/${ruleId}`, token, { method: 'PATCH', body: JSON.stringify(rule) }),
  deleteRule: (id: string, ruleId: string, token: string) =>
    req<{ data: any }>(`/api/pricelists/${id}/rules/${ruleId}`, token, { method: 'DELETE' }),

  async getCoverage(subProductId: string, token: string) {
    const body = await req<{ data: { pricelists: any[] } }>(
      `/api/pricelists/coverage/${subProductId}`,
      token
    );
    return body.data as { pricelists: any[] };
  },

  reorderRules(pricelistId: string, orderedIds: string[], token: string) {
    return req<{ success: boolean }>(`/api/pricelists/${pricelistId}/rules/reorder`, token, {
      method: 'PATCH',
      body: JSON.stringify({ orderedIds }),
    });
  },
};

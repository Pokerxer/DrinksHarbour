const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

async function req(url: string, token: string, opts: RequestInit = {}) {
  const res = await fetch(`${API_URL}${url}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.message || 'Request failed');
  return body;
}

export const pricelistService = {
  list:   (token: string, params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return req(`/api/pricelists${qs}`, token);
  },
  get:    (id: string, token: string) => req(`/api/pricelists/${id}`, token),
  create: (data: any, token: string)  => req('/api/pricelists', token, { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any, token: string) =>
    req(`/api/pricelists/${id}`, token, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string, token: string) => req(`/api/pricelists/${id}`, token, { method: 'DELETE' }),
  apply:  (id: string, token: string) => req(`/api/pricelists/${id}/apply`, token, { method: 'POST' }),

  addRule:    (id: string, rule: any, token: string) =>
    req(`/api/pricelists/${id}/rules`, token, { method: 'POST', body: JSON.stringify(rule) }),
  updateRule: (id: string, ruleId: string, rule: any, token: string) =>
    req(`/api/pricelists/${id}/rules/${ruleId}`, token, { method: 'PATCH', body: JSON.stringify(rule) }),
  deleteRule: (id: string, ruleId: string, token: string) =>
    req(`/api/pricelists/${id}/rules/${ruleId}`, token, { method: 'DELETE' }),
};

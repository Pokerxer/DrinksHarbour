import type { TemplatePreferences } from '@/utils/print/templates/registry';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
export async function documentPreferences(
  token: string,
  slug?: string,
  value?: TemplatePreferences,
  signal?: AbortSignal
): Promise<TemplatePreferences> {
  const response = await fetch(`${API}/api/tenants/document-templates`, {
    method: value ? 'PUT' : 'GET',
    cache: 'no-store',
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(slug ? { 'x-tenant-slug': slug } : {}),
    },
    ...(value ? { body: JSON.stringify(value) } : {}),
  });
  const result = (await response.json()) as { message?: string; data: TemplatePreferences };
  if (!response.ok) throw new Error(result.message || 'Unable to load document templates');
  return result.data as TemplatePreferences;
}

// Services for subcategory API calls

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface AdminSubCategory {
  _id: string;
  name: string;
  slug: string;
  type?: string;
  style?: string;
  status: string;
  description?: string;
  shortDescription?: string;
  thumbnailImage?: { url: string; alt?: string };
  featuredImage?: { url: string; alt?: string };
  bannerImage?: { url: string; alt?: string };
  displayOrder?: number;
  isFeatured?: boolean;
  isTrending?: boolean;
  isPopular?: boolean;
  showInMenu?: boolean;
  parent: { _id: string; name: string } | string | null;
  productCount?: number;
  typicalFlavors?: string[];
  commonPairings?: string[];
  seasonal?: { spring: boolean; summer: boolean; fall: boolean; winter: boolean };
  color?: string;
  icon?: string;
  tagline?: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[];
  canonicalUrl?: string;
  notes?: string;
  createdAt: string;
}

export interface SubCategoryFormData {
  name: string;
  slug: string;
  parent: string;
  type?: string;
  subType?: string;
  style?: string;
  displayName?: string;
  tagline?: string;
  description?: string;
  shortDescription?: string;
  status?: string;
  displayOrder?: number;
  isFeatured?: boolean;
  isTrending?: boolean;
  isPopular?: boolean;
  showInMenu?: boolean;
  color?: string;
  icon?: string;
  notes?: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  canonicalUrl?: string;
  typicalFlavors?: string;
  commonPairings?: string;
  seasonalSpring?: boolean;
  seasonalSummer?: boolean;
  seasonalFall?: boolean;
  seasonalWinter?: boolean;
  thumbnailImageFile?: File | null;
  featuredImageFile?: File | null;
  bannerImageFile?: File | null;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

async function apiFetch<T>(url: string, options: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Request failed');
  return json.data;
}

export async function getAdminSubCategories(token: string): Promise<{ subcategories: AdminSubCategory[]; total: number }> {
  return apiFetch(`${API_URL}/api/subcategories/admin`, { headers: authHeaders(token) });
}

export function buildSubCategoryFormData(data: SubCategoryFormData): FormData {
  const form = new FormData();

  const fileKeys = new Set(['thumbnailImageFile', 'featuredImageFile', 'bannerImageFile']);
  const fileFieldMap: Record<string, string> = {
    thumbnailImageFile: 'thumbnailImage',
    featuredImageFile: 'featuredImage',
    bannerImageFile: 'bannerImage',
  };

  Object.entries(data).forEach(([k, v]) => {
    if (fileKeys.has(k)) {
      if (v instanceof File) form.append(fileFieldMap[k], v);
    } else if (v !== undefined && v !== null) {
      form.append(k, String(v));
    }
  });

  return form;
}

export async function createSubCategory(token: string, data: SubCategoryFormData): Promise<{ subcategory: AdminSubCategory }> {
  return apiFetch(`${API_URL}/api/subcategories/admin`, {
    method: 'POST',
    headers: authHeaders(token),
    body: buildSubCategoryFormData(data),
  });
}

export async function updateSubCategory(token: string, id: string, data: SubCategoryFormData): Promise<{ subcategory: AdminSubCategory }> {
  return apiFetch(`${API_URL}/api/subcategories/admin/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: buildSubCategoryFormData(data),
  });
}

export async function deleteAdminSubCategory(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/subcategories/admin/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Delete failed');
}

export async function generateSubCategory(
  body: { topic: string; parentName: string },
  token: string,
): Promise<{ success: boolean; data: any }> {
  const res = await fetch(`${API_URL}/api/subcategories/admin/ai/generate-subcategory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json: any = await res.json();
  if (!res.ok) throw new Error(json.message || 'AI generation failed');
  return json;
}

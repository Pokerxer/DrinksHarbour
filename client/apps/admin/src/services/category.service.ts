import { readJson, readError } from './response';
// Services for category API calls

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

interface Category {
  _id: string;
  name: string;
  slug: string;
  type: string;
  description?: string;
  industry?: string;
}

interface SubCategory {
  _id: string;
  name: string;
  slug: string;
  type: string;
  parent: string;
  industry?: string;
  description?: string;
}

export interface AdminCategory {
  _id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  description?: string;
  /** Industry scope — additive 2026-11-02; absent = legacy/global. */
  industry?: string;
  thumbnailImage?: { url: string; alt?: string };
  featuredImage?: { url: string; alt?: string };
  bannerImage?: { url: string; alt?: string };
  displayOrder?: number;
  isFeatured?: boolean;
  parent?: string | null;
  productCount?: number;
  createdAt: string;
}

export interface CategoryFormData {
  name: string;
  slug: string;
  type: string;
  displayName?: string;
  tagline?: string;
  subType?: string;
  alcoholCategory?: string;
  description?: string;
  shortDescription?: string;
  /** Industry scope — additive 2026-11-02; '' = legacy/global. */
  industry?: string;
  status?: string;
  displayOrder?: number;
  parent?: string;
  isFeatured?: boolean;
  isTrending?: boolean;
  isPopular?: boolean;
  isNewArrival?: boolean;
  showInMenu?: boolean;
  showOnHomepage?: boolean;
  color?: string;
  icon?: string;
  defaultSort?: string;
  notes?: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  canonicalUrl?: string;
  bannerLink?: string;
  bannerLinkType?: string;
  thumbnailImageFile?: File | null;
  featuredImageFile?: File | null;
  bannerImageFile?: File | null;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

async function apiFetch<T>(url: string, options: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const json = await readJson<{ data: T; message?: string }>(res);
  if (!res.ok) throw new Error(json.message || 'Request failed');
  return json.data;
}

export async function getAdminCategories(token: string): Promise<{ categories: AdminCategory[]; total: number }> {
  return apiFetch(`${API_URL}/api/categories/admin`, { headers: authHeaders(token) });
}

function buildCategoryFormData(data: CategoryFormData): FormData {
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

export async function createCategory(token: string, data: CategoryFormData): Promise<{ category: AdminCategory }> {
  return apiFetch(`${API_URL}/api/categories/admin`, {
    method: 'POST',
    headers: authHeaders(token),
    body: buildCategoryFormData(data),
  });
}

export async function updateCategory(token: string, id: string, data: CategoryFormData): Promise<{ category: AdminCategory }> {
  return apiFetch(`${API_URL}/api/categories/admin/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: buildCategoryFormData(data),
  });
}

export async function deleteAdminCategory(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/categories/admin/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  const json = await readJson<{ message?: string }>(res);
  if (!res.ok) throw new Error(json.message || 'Delete failed');
}

export const categoryService = {
  /**
   * Fetch all categories — compat wrapper (existing 8+ call sites keep the
   * plain array). For the applied industry-scope fidelity use
   * {@link getCategoriesWithMeta}.
   */
  async getCategories(token: string, mode?: 'picker'): Promise<Category[]> {
    const { categories } = await this.getCategoriesWithMeta(token, mode);
    return categories;
  },

  /**
   * Fetch all categories WITH the server-applied industry scope echo
   * (industries-industry-scope round, 2026-11-02): `GET /api/categories`
   * responds additively with `meta.industries` — the exact set the server
   * filtered this caller's list by, or null when the caller is
   * unprofiled/legacy (or an anonymous request). Non-breaking: callers that
   * only need the array keep using getCategories().
   */
  async getCategoriesWithMeta(token: string, mode?: 'picker'): Promise<{ categories: Category[]; industriesMeta: string[] | null }> {
    const endpoint = mode === 'picker' ? '/api/categories/picker' : '/api/categories';
    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to fetch categories');
    }

    // The echo lives at the envelope's `meta`; tolerate a `data.meta` shape
    // defensively (server-side shape evolution).
    const result = await readJson<{ data?: { categories?: Category[]; meta?: { industries?: string[] | null } }; meta?: { industries?: string[] | null } }>(response);
    const industriesMeta = result.meta?.industries ?? result.data?.meta?.industries ?? null;
    return { categories: result.data?.categories || [], industriesMeta };
  },

  /**
   * Fetch subcategories by category ID WITH the applied-scope echo (same
   * contract as getCategoriesWithMeta).
   */
  async getSubCategoriesWithMeta(token: string, categoryId?: string, mode?: 'picker'): Promise<{ subCategories: SubCategory[]; industriesMeta: string[] | null }> {
    const endpoint = mode === 'picker' ? '/api/subcategories/picker' : '/api/subcategories';
    const url = categoryId
      ? `${API_URL}${endpoint}?category=${encodeURIComponent(categoryId)}`
      : `${API_URL}${endpoint}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to fetch subcategories');
    }

    const result = await readJson<{ data?: SubCategory[]; meta?: { industries?: string[] | null } }>(response);
    return { subCategories: result.data || [], industriesMeta: result.meta?.industries ?? null };
  },

  /**
   * Fetch subcategories by category ID
   */
  async getSubCategories(token: string, categoryId?: string, mode?: 'picker'): Promise<SubCategory[]> {
    const { subCategories } = await this.getSubCategoriesWithMeta(token, categoryId, mode);
    return mode === 'picker' ? subCategories.map(row => ({
      ...row,
      parent: typeof row.parent === 'string' ? row.parent : (row.parent as { _id?: string } | null)?._id || categoryId || '',
    })) : subCategories;
  },

  async generateCategory(
    body: { topic: string; parentName?: string },
    token: string,
  ): Promise<{ success: boolean; data: any }> {
    const res = await fetch(`${API_URL}/api/categories/admin/ai/generate-category`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const json: any = await res.json();
    if (!res.ok) throw new Error(json.message || 'AI generation failed');
    return json;
  },
};

// Services for category API calls

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

interface Category {
  _id: string;
  name: string;
  slug: string;
  type: string;
  description?: string;
}

interface SubCategory {
  _id: string;
  name: string;
  slug: string;
  type: string;
  parent: string;
  description?: string;
}

export interface AdminCategory {
  _id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  description?: string;
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
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Delete failed');
}

export const categoryService = {
  /**
   * Fetch all categories
   */
  async getCategories(token: string): Promise<Category[]> {
    const response = await fetch(`${API_URL}/api/categories`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch categories');
    }

    const result = await response.json();
    return result.data?.categories || [];
  },

  /**
   * Fetch subcategories by category ID
   */
  async getSubCategories(token: string, categoryId?: string): Promise<SubCategory[]> {
    const url = categoryId
      ? `${API_URL}/api/subcategories?category=${categoryId}`
      : `${API_URL}/api/subcategories`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch subcategories');
    }

    const result = await response.json();
    return result.data || [];
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

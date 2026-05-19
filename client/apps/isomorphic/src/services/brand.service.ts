// @ts-nocheck
// Services for brand API calls

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

interface Brand {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  primaryCategory?: string;
  countryOfOrigin?: string;
  isFeatured?: boolean;
  isPremium?: boolean;
  verified?: boolean;
}

export interface AdminBrand {
  _id: string;
  name: string;
  slug: string;
  brandType?: string;
  primaryCategory?: string;
  status: string;
  logo?: { url: string; alt?: string };
  featuredImage?: { url: string; alt?: string };
  bannerImage?: { url: string; alt?: string };
  displayOrder?: number;
  isFeatured?: boolean;
  verified?: boolean;
  countryOfOrigin?: string;
  productCount?: number;
  createdAt: string;
}

export interface BrandFormData {
  name: string;
  slug: string;
  legalName?: string;
  tradingAs?: string;
  description?: string;
  shortDescription?: string;
  tagline?: string;
  story?: string;
  founded?: number | string;
  founderName?: string;
  brandType?: string;
  primaryCategory?: string;
  specializations?: string;
  countryOfOrigin?: string;
  region?: string;
  hqCity?: string;
  hqCountry?: string;
  website?: string;
  email?: string;
  phone?: string;
  socialFacebook?: string;
  socialInstagram?: string;
  socialTwitter?: string;
  socialYoutube?: string;
  socialLinkedin?: string;
  socialTiktok?: string;
  brandColorPrimary?: string;
  brandColorSecondary?: string;
  brandColorAccent?: string;
  status?: string;
  isFeatured?: boolean;
  isPopular?: boolean;
  isTrending?: boolean;
  isPremium?: boolean;
  isCraft?: boolean;
  isLocal?: boolean;
  verified?: boolean;
  displayOrder?: number;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  canonicalUrl?: string;
  notes?: string;
  logoFile?: File | null;
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

export function buildBrandFormData(data: BrandFormData): FormData {
  const form = new FormData();

  const fileFieldMap: Record<string, string> = {
    logoFile: 'logo',
    featuredImageFile: 'featuredImage',
    bannerImageFile: 'bannerImage',
  };
  const fileKeys = new Set(Object.keys(fileFieldMap));

  Object.entries(data).forEach(([k, v]) => {
    if (fileKeys.has(k)) {
      if (v instanceof File) form.append(fileFieldMap[k], v);
    } else if (v !== undefined && v !== null) {
      form.append(k, String(v));
    }
  });

  return form;
}

export async function getAdminBrands(token: string): Promise<{ brands: AdminBrand[]; total: number }> {
  return apiFetch(`${API_URL}/api/brands/admin`, { headers: authHeaders(token) });
}

export async function createBrand(token: string, data: BrandFormData): Promise<{ brand: AdminBrand }> {
  return apiFetch(`${API_URL}/api/brands/admin`, {
    method: 'POST',
    headers: authHeaders(token),
    body: buildBrandFormData(data),
  });
}

export async function updateBrand(token: string, id: string, data: BrandFormData): Promise<{ brand: AdminBrand }> {
  return apiFetch(`${API_URL}/api/brands/admin/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: buildBrandFormData(data),
  });
}

export async function deleteAdminBrand(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/brands/admin/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Delete failed');
}

export const brandService = {
  /**
   * Fetch all brands
   */
  async getBrands(token: string, options?: { limit?: number; search?: string }): Promise<Brand[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.search) params.set('search', options.search);
    params.set('status', 'active');

    const url = `${API_URL}/api/brands?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch brands');
    }

    const result = await response.json();
    return result.data?.brands || [];
  },

  /**
   * Fetch brands by category
   */
  async getBrandsByCategory(token: string, categoryId: string): Promise<Brand[]> {
    const response = await fetch(`${API_URL}/api/brands/category/${categoryId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch brands by category');
    }

    const result = await response.json();
    return result.data || [];
  },

  /**
   * Fetch single brand by ID
   */
  async getBrandById(token: string, brandId: string): Promise<Brand | null> {
    const response = await fetch(`${API_URL}/api/brands/${brandId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch brand');
    }

    const result = await response.json();
    return result.data || null;
  },
};

'use server';

import { LoginSchema } from "@/utils/validators/login.schema";
import { SignUpSchema } from "@/utils/validators/signup.schema";
import { cookies } from "next/headers";

const API_ENDPOINT = process.env.NEXT_PUBLIC_API_URL || process.env.API_ENDPOINT || 'http://localhost:5001';

async function getAuthToken() {
  const cookieStore = await cookies();
  return cookieStore.get('token')?.value || null;
}

async function apiFetch(url: string, options: RequestInit = {}) {
  const token = await getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_ENDPOINT}${url}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API request failed with status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error in API fetch to ${url}:`, error);
    throw error;
  }
}

export async function getBanner(id: string) {
  return apiFetch(`/api/banner/${id}`, { method: 'GET' });
}

export async function getBanners(type?: string) {
  const query = type ? `?type=${type}` : '';
  return apiFetch(`/api/banner${query}`, { method: 'GET' });
}

export async function getBeverages(filters: {
  categoryId?: string;
  isAlcoholic?: boolean;
  vendorId?: string;
  minPrice?: number;
  maxPrice?: number;
} = {}) {
  const queryParams = new URLSearchParams();
  if (filters.categoryId) queryParams.append('categoryId', filters.categoryId);
  if (filters.isAlcoholic !== undefined) queryParams.append('isAlcoholic', filters.isAlcoholic.toString());
  if (filters.vendorId) queryParams.append('vendorId', filters.vendorId);
  if (filters.minPrice) queryParams.append('minPrice', filters.minPrice.toString());
  if (filters.maxPrice) queryParams.append('maxPrice', filters.maxPrice.toString());

  const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
  return apiFetch(`/api/beverage${query}`, { method: 'GET' });
}

export async function getBeverageBySlug(slug: string, style?: string, size?: string) {
  const query = `?style=${style || ''}&size=${size || ''}`;
  return apiFetch(`/api/beverage/${slug}${query}`, { method: 'GET' });
}

export async function getBeverageById(id: string, style?: string, size?: string) {
  const query = `?style=${style || ''}&size=${size || ''}`;
  return apiFetch(`/api/beverage/id/${id}${query}`, { method: 'GET' });
}

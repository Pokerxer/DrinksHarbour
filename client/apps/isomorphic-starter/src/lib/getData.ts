'use server' import { LoginSchema } from "@/utils/validators/login.schema";
import { SignUpSchema } from "@/utils/validators/signup.schema";
import { cookies } from "next/headers"; // Define the base API endpoint (use environment variable in production);
const API_ENDPOINT = process.env.API_ENDPOINT || 'http://localhost:5001'; // Helper function to get auth token from cookies (since localStorage is client-side)
async function getAuthToken() {
const cookieStore = await cookies(); return cookieStore.get('token')?.value || null;
} // Generic fetch wrapper for consistency and better error handling
async function apiFetch(url: string,
options: RequestInit = {}) {
const token = await getAuthToken(); const headers = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}), ...options.headers, };
try {
const response = await fetch(`${API_ENDPOINT}${url}`, { ...options, headers, credentials: 'include', // Include cookies for cross-origin if needed }); if (!response.ok) {
const errorData = await response.json().catch(() => ({})); throw new Error(errorData.message || `API request failed with status ${response.status}`); } return await response.json(); } catch (error) { console.error(`Error in API fetch to ${url}:`, error); throw error; // Re-throw for client-side handling }
} // Banner-related functions
export async function getBanner(id: string) {
return apiFetch(`/api/banner/${id}`, { method: 'GET' });
}
export async function getBanners(type?: string) {
const query = type ? `?type=${type}` : ''; return apiFetch(`/api/banner${query}`, { method: 'GET' });
} // Product (Beverage)-related functions, adapted for beverages
// Added filters for beverage-specific attributes like alcoholic/non-alcoholic
export async function getBeverages(filters: { categoryId?: string; isAlcoholic?: boolean; vendorId?: string; minPrice?: number; maxPrice?: number } = {}) {
const queryParams = new URLSearchParams(); if (filters.categoryId) queryParams.append('categoryId', filters.categoryId); if (filters.isAlcoholic !== undefined) queryParams.append('isAlcoholic', filters.isAlcoholic.toString()); if (filters.vendorId) queryParams.append('vendorId', filters.vendorId); if (filters.minPrice) queryParams.append('minPrice', filters.minPrice.toString()); if (filters.maxPrice) queryParams.append('maxPrice', filters.maxPrice.toString()); const query = queryParams.toString() ? `?${queryParams.toString()}` : ''; return apiFetch(`/api/beverage${query}`, { method: 'GET' }); // Renamed endpoint to /beverage for specificity
}
export async function getBeverageBySlug(slug: string,
style?: string, size?: string) {
const query = `?style=${style || ''}&size=${size || ''}`; return apiFetch(`/api/beverage/${slug}${query}`, { method: 'GET' });
}
export async function getBeverageById(id: string,
style?: string, size?: string) {
const query = `?style=${style || ''}&size=${size || ''}`; return apiFetch(`/api/beverage/${id}${query}`, { method: 'GET' });
} // Subcategory-related functions
export async function fetchSubcategoriesFromCategory(categoryId: string) {
return apiFetch(`/api/subcategory?categoryId=${categoryId}`, { method: 'GET' });
}
export async function fetchSubcategories() {
return apiFetch(`/api/subcategory`, { method: 'GET' });
}
export async function getSubcategoryById(id: string) {
return apiFetch(`/api/subcategory/${id}`, { method: 'GET' });
} // Category-related functions
export async function fetchCategories() {
return apiFetch(`/api/category`, { method: 'GET' });
}
export async function getCategoryById(id: string) {
return apiFetch(`/api/category/${id}`, { method: 'GET' });
}
export async function editCategory(id: string,
data: any) {
return apiFetch(`/api/category/${id}`, { method: 'PUT',
body: JSON.stringify(data), });
}
export async function deleteCategory(ids: string[]) {
return apiFetch('/api/category', { method: 'DELETE',
body: JSON.stringify({ ids }), });
} // Flash Deals (adapted for beverage promotions)
export async function getFlashDeals() {
return apiFetch(`/api/flashdeals`, { method: 'GET' });
} // Cart and User-related functions
export async function saveToCart(cart: any) {
return apiFetch('/api/user/cart', { method: 'POST',
body: JSON.stringify(cart), });
}
export async function saveAddress(address: any) {
return apiFetch('/api/user/address', { method: 'POST',
body: JSON.stringify({ address }), });
} // Authentication functions
export async function signIn(user: LoginSchema) {
const response = await fetch(`${API_ENDPOINT}/api/user/sign-in`, { method: 'POST',
headers: { 'Content-Type': 'application/json' }, credentials: 'include',
body: JSON.stringify(user), }); if (!response.ok) {
const errorData = await response.json(); throw new Error(errorData.message || 'Sign-in failed'); } // Assuming backend sets cookies/tokens return response.json();
}
export async function signUp(user: SignUpSchema) {
return apiFetch('/api/user/sign-up', { method: 'POST',
body: JSON.stringify({ user }), });
}
export async function signOut() {
const response = await fetch(`${API_ENDPOINT}/api/user/sign-out`, { method: 'GET',
headers: { 'Content-Type': 'application/json' }, credentials: 'include', }); if (!response.ok) {
const errorData = await response.json(); throw new Error(errorData.message || 'Sign-out failed'); } // Clear client-side storage const cookieStore = await cookies(); cookieStore.delete('token'); cookieStore.delete('refreshToken'); return { success: true,
message: 'Successfully signed out' };
} // Subproduct-related functions (assuming subproducts are variants like bottle sizes for beverages)
export async function fetchSubproductsByCategoryId(categoryId: string) {
return apiFetch(`/api/category/${categoryId}`, { method: 'GET' });
}
export async function fetchSubproductsByBeverageId(id: string) {
return apiFetch(`/api/beverage/${id}/subproducts`, { method: 'GET' }); // Adjusted endpoint for clarity
}
export async function getSubproductBySlug(slug: string) {
return apiFetch(`/api/subproduct/${slug}`, { method: 'GET' });
}
export async function fetchSubproducts() {
return apiFetch('/api/subproduct', { method: 'GET' });
}
export async function deleteSubproduct(ids: string[]) {
return apiFetch('/api/subproduct', { method: 'DELETE',
body: JSON.stringify({ ids }), });
}
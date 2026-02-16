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

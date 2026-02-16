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
};

// Services for product API calls

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

interface ProductData {
  name: string;
  type: string;
  category: string;
  description?: string;
  basePrice?: number;
  images?: Array<{
    url: string;
    alt?: string;
    isPrimary?: boolean;
  }>;
  [key: string]: any;
}

export const productService = {
  async createProduct(data: ProductData, token: string) {
    const response = await fetch(`${API_URL}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create product');
    }

    return response.json();
  },

  async createSubProduct(data: ProductData, token: string) {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
    console.log('=== SERVICE CALL ===');
    console.log('URL:', `${API_URL}/api/subproducts`);
    console.log('Token exists:', !!token);
    console.log('Token length:', token?.length);
    
    try {
      const response = await fetch(`${API_URL}/api/subproducts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        const error = await response.json();
        console.log('Response error:', error);
        throw new Error(error.message || 'Failed to create sub product');
      }

      return response.json();
    } catch (err: any) {
      console.error('Fetch error:', err);
      throw err;
    }
  },

  async getProducts(token: string, params?: Record<string, any>) {
    const queryString = params ? new URLSearchParams(params).toString() : '';
    const url = `${API_URL}/api/products${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch products');
    }

    return response.json();
  },

  async getProductById(id: string, token: string) {
    const response = await fetch(`${API_URL}/api/products/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch product');
    }

    return response.json();
  },

  async updateProduct(id: string, data: Partial<ProductData>, token: string) {
    const response = await fetch(`${API_URL}/api/products/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update product');
    }

    return response.json();
  },

  async deleteProduct(id: string, token: string) {
    const response = await fetch(`${API_URL}/api/products/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete product');
    }

    return response.json();
  },
};

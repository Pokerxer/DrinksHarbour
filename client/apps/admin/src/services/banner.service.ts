// Services for banner API calls

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export const bannerService = {
  async getBanners(token: string, params?: Record<string, any>) {
    const queryString = params ? new URLSearchParams(params).toString() : '';
    const url = `${API_URL}/api/banners${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch banners');
    }

    return response.json();
  },

  async getBannerById(id: string, token: string) {
    const response = await fetch(`${API_URL}/api/banners/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch banner');
    }

    return response.json();
  },

  async createBanner(data: any, token: string) {
    const response = await fetch(`${API_URL}/api/banners`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create banner');
    }

    return response.json();
  },

  async updateBanner(id: string, data: any, token: string) {
    const response = await fetch(`${API_URL}/api/banners/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update banner');
    }

    return response.json();
  },

  async patchBanner(id: string, data: any, token: string) {
    const response = await fetch(`${API_URL}/api/banners/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to patch banner');
    }

    return response.json();
  },

  async deleteBanner(id: string, token: string) {
    const response = await fetch(`${API_URL}/api/banners/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete banner');
    }

    return response.json();
  },

  async updateBannerStatus(id: string, status: string, token: string) {
    const response = await fetch(`${API_URL}/api/banners/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update banner status');
    }

    return response.json();
  },

  async toggleBannerActive(id: string, token: string) {
    const response = await fetch(`${API_URL}/api/banners/${id}/toggle-active`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to toggle banner active status');
    }

    return response.json();
  },

  async bulkUpdateStatus(bannerIds: string[], status: string, token: string) {
    const response = await fetch(`${API_URL}/api/banners/bulk/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ bannerIds, status }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to bulk update banner status');
    }

    return response.json();
  },

  async cloneBanner(id: string, token: string) {
    const response = await fetch(`${API_URL}/api/banners/${id}/clone`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to clone banner');
    }

    return response.json();
  },

  async getBannerAnalytics(id: string, token: string) {
    const response = await fetch(`${API_URL}/api/banners/${id}/analytics`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch banner analytics');
    }

    return response.json();
  },

  async trackImpression(id: string) {
    await fetch(`${API_URL}/api/banners/${id}/impression`, {
      method: 'POST',
    });
  },

  async trackClick(id: string) {
    await fetch(`${API_URL}/api/banners/${id}/click`, {
      method: 'POST',
    });
  },

  async getActiveBannersForPlacement(placement: string, params?: Record<string, any>) {
    const queryString = params ? new URLSearchParams(params).toString() : '';
    const url = `${API_URL}/api/banners/placement/${placement}${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch active banners');
    }

    return response.json();
  },

  async generateBannerContent(params: {
    productId?: string;
    categoryId?: string;
    brandId?: string;
    bannerType?: string;
    placement?: string;
    customContext?: string;
    style?: 'playful' | 'elegant' | 'urgent' | 'calm';
  }, token: string) {
    const response = await fetch(`${API_URL}/api/banner-ai/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to generate banner content');
    }

    return response.json();
  },

  async generateBannerSuggestions(params: {
    productId?: string;
    categoryId?: string;
    brandId?: string;
    count?: number;
  }, token: string) {
    const response = await fetch(`${API_URL}/api/banner-ai/suggestions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to generate banner suggestions');
    }

    return response.json();
  },

  async enhanceBannerContent(params: {
    title?: string;
    subtitle?: string;
    ctaText?: string;
    goal?: 'urgency' | 'engagement' | 'trust' | 'conversions';
    style?: string;
  }, token: string) {
    const response = await fetch(`${API_URL}/api/banner-ai/enhance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to enhance banner content');
    }

    return response.json();
  },

  async enhanceBannerField(params: {
    field: 'title' | 'subtitle' | 'ctaText';
    value: string;
    action?: 'rewrite' | 'expand' | 'shorten' | 'punchier';
    context?: { type?: string; placement?: string; title?: string };
  }, token: string) {
    const response = await fetch(`${API_URL}/api/banner-ai/enhance-field`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to enhance field');
    }

    return response.json();
  },

  async generateImagePrompt(params: {
    title: string;
    subtitle?: string;
    bannerType?: string;
    style?: string;
  }, token: string) {
    const response = await fetch(`${API_URL}/api/banner-ai/image-prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to generate image prompt');
    }

    return response.json();
  },

  async getBannerContextData(token: string) {
    const response = await fetch(`${API_URL}/api/banner-ai/context-data`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch context data');
    }

    return response.json();
  },
};

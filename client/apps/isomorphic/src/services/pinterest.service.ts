const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface PinterestImage {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  link: string;
  pinUrl: string;
  boardId?: string;
}

export interface PinterestSearchResponse {
  success: boolean;
  count: number;
  results: PinterestImage[];
}

export interface PinterestStatusResponse {
  success: boolean;
  authenticated: boolean;
  configured: boolean;
  message: string;
}

export const pinterestService = {
  async search(query: string, limit: number = 20): Promise<PinterestSearchResponse> {
    const response = await fetch(
      `${API_URL}/api/pinterest/search?q=${encodeURIComponent(query)}&limit=${limit}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to search Pinterest');
    }

    return response.json();
  },

  async getPins(limit: number = 50): Promise<PinterestSearchResponse> {
    const response = await fetch(
      `${API_URL}/api/pinterest/pins?limit=${limit}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get Pinterest pins');
    }

    return response.json();
  },

  async getBoards() {
    const response = await fetch(`${API_URL}/api/pinterest/boards`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get Pinterest boards');
    }

    return response.json();
  },

  async getOAuthUrl(): Promise<{ url: string; state: string }> {
    const response = await fetch(`${API_URL}/api/pinterest/oauth-url`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get Pinterest OAuth URL');
    }

    return response.json();
  },

  async checkStatus(): Promise<PinterestStatusResponse> {
    const response = await fetch(`${API_URL}/api/pinterest/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to check Pinterest status');
    }

    return response.json();
  },
};
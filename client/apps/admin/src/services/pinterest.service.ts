const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface ImageSearchResult {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  thumbUrl: string;
  link: string;
  credit: string;
  creditUrl: string;
}

export interface ImageSearchResponse {
  success: boolean;
  count: number;
  results: ImageSearchResult[];
}

export interface ImageSearchStatus {
  success: boolean;
  configured: boolean;
  message: string;
}

export const pinterestService = {
  async checkStatus(): Promise<ImageSearchStatus> {
    const response = await fetch(`${API_URL}/api/pinterest/status`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to check status');
    }
    return response.json();
  },

  async search(query: string, limit: number = 30): Promise<ImageSearchResponse> {
    const response = await fetch(
      `${API_URL}/api/pinterest/search?q=${encodeURIComponent(query)}&limit=${limit}`
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to search Pinterest');
    }
    return response.json();
  },
};

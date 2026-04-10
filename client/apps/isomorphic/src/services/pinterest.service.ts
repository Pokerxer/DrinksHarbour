const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface PinterestImage {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  link: string;
  pinUrl: string;
}

export interface PinterestSearchResponse {
  success: boolean;
  count: number;
  results: PinterestImage[];
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
};
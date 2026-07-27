// Services for review moderation API calls

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

async function handle(response: Response) {
  if (!response.ok) {
    const error: any = await response.json().catch(() => ({}));
    throw new Error(error?.message || 'Request failed');
  }
  return response.json();
}

export const reviewService = {
  async getReviews(token: string, params?: Record<string, any>) {
    const clean = Object.fromEntries(
      Object.entries(params || {}).filter(([, v]) => v !== '' && v != null)
    );
    const queryString = new URLSearchParams(clean as any).toString();
    return handle(
      await fetch(
        `${API_URL}/api/reviews${queryString ? `?${queryString}` : ''}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )
    );
  },

  async getStats(token: string) {
    return handle(
      await fetch(`${API_URL}/api/reviews/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    );
  },

  async setStatus(id: string, status: string, token: string, note?: string) {
    return handle(
      await fetch(`${API_URL}/api/reviews/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status, ...(note ? { note } : {}) }),
      })
    );
  },

  async deleteReview(id: string, token: string) {
    return handle(
      await fetch(`${API_URL}/api/reviews/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
    );
  },
};

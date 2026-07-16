// Services for blog API calls

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

async function request(path: string, token: string, options: RequestInit = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    let message = 'Request failed';
    try {
      const error = await response.json();
      message = (error as any)?.message || message;
    } catch {}
    throw new Error(message);
  }
  return response.json();
}

export type GenerateField =
  | 'title'
  | 'excerpt'
  | 'tags'
  | 'seoTitle'
  | 'seoDescription'
  | 'imageAlt';

export const blogService = {
  getPosts(token: string, params?: Record<string, any>) {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
    return request(`/api/blog/admin${qs}`, token);
  },
  getPostById(id: string, token: string) {
    return request(`/api/blog/admin/${id}`, token);
  },
  createPost(data: any, token: string) {
    return request('/api/blog/admin', token, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  updatePost(id: string, data: any, token: string) {
    return request(`/api/blog/admin/${id}`, token, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  setStatus(id: string, status: 'draft' | 'published', token: string) {
    return request(`/api/blog/admin/${id}/status`, token, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
  deletePost(id: string, token: string) {
    return request(`/api/blog/admin/${id}`, token, { method: 'DELETE' });
  },
  generatePost(body: { topic: string; category?: string }, token: string) {
    return request('/api/blog/admin/ai/generate-post', token, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  generateField(body: { field: GenerateField; post: any }, token: string) {
    return request('/api/blog/admin/ai/generate-field', token, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  generateSeo(body: { post: any }, token: string) {
    return request('/api/blog/admin/ai/generate-seo', token, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  generateBlock(
    body: { action: 'rewrite' | 'expand' | 'shorten'; block: any; post: any },
    token: string
  ) {
    return request('/api/blog/admin/ai/generate-block', token, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};

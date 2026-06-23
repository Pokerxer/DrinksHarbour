const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface Meeting {
  _id: string;
  vendor: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  allDay?: boolean;
  location?: string;
  attendees: string[];
  status: 'scheduled' | 'done' | 'cancelled';
  notes?: string;
  createdAt?: string;
}

export interface CreateMeetingInput {
  vendor: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  allDay?: boolean;
  location?: string;
  attendees?: string[];
  notes?: string;
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const body = await res.json();
  if (!res.ok || !body.success)
    throw new Error(body.message || 'Request failed');
  return body;
}

export const meetingService = {
  async getAll(
    token: string,
    params: { vendor?: string; start?: string; end?: string } = {}
  ): Promise<Meeting[]> {
    const qs = new URLSearchParams();
    if (params.vendor) qs.set('vendor', params.vendor);
    if (params.start) qs.set('start', params.start);
    if (params.end) qs.set('end', params.end);
    const res = await apiFetch<{ success: boolean; data: Meeting[] }>(
      `${API_URL}/api/meetings?${qs}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
  },

  async create(input: CreateMeetingInput, token: string): Promise<Meeting> {
    const res = await apiFetch<{ success: boolean; data: Meeting }>(
      `${API_URL}/api/meetings`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      }
    );
    return res.data;
  },

  async update(
    id: string,
    input: Partial<CreateMeetingInput> & { status?: string },
    token: string
  ): Promise<Meeting> {
    const res = await apiFetch<{ success: boolean; data: Meeting }>(
      `${API_URL}/api/meetings/${id}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      }
    );
    return res.data;
  },

  async delete(id: string, token: string): Promise<void> {
    await apiFetch(`${API_URL}/api/meetings/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  },
};

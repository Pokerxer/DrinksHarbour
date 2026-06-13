const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  _id: string;
  vendor: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  assignedTo?: string;
  tags: string[];
  notes?: string;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateTaskInput {
  vendor: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  assignedTo?: string;
  tags?: string[];
  notes?: string;
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const body = await res.json();
  if (!res.ok || !body.success)
    throw new Error(body.message || 'Request failed');
  return body;
}

export const taskService = {
  async getAll(
    token: string,
    params: { vendor?: string; status?: string; priority?: string } = {}
  ): Promise<Task[]> {
    const qs = new URLSearchParams();
    if (params.vendor) qs.set('vendor', params.vendor);
    if (params.status) qs.set('status', params.status);
    if (params.priority) qs.set('priority', params.priority);
    const res = await apiFetch<{ success: boolean; data: Task[] }>(
      `${API_URL}/api/tasks?${qs}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
  },

  async create(input: CreateTaskInput, token: string): Promise<Task> {
    const res = await apiFetch<{ success: boolean; data: Task }>(
      `${API_URL}/api/tasks`,
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
    input: Partial<CreateTaskInput> & { status?: TaskStatus },
    token: string
  ): Promise<Task> {
    const res = await apiFetch<{ success: boolean; data: Task }>(
      `${API_URL}/api/tasks/${id}`,
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
    await apiFetch(`${API_URL}/api/tasks/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  },
};

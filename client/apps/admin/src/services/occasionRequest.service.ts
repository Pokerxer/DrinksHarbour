import { readError, readJson } from './response';
export type OccasionRequest = {
  _id: string; reference: string; occasion: string; name: string; channel: 'email' | 'whatsapp'; email?: string; whatsapp?: string; city: string; date?: string; guests?: number; budget?: number; notes: string; preferences: string[]; items: { productId: string; name: string; quantity: number }[];
  attachment?: { name: string; contentType: string; size: number }; status: 'pending' | 'draft' | 'sending' | 'sent' | 'delivery_failed'; createdAt: string; dueAt: string; draft: string; revision: number; aiRunning?: boolean; busyUntil?: string; sentAt?: string; deliveryMethod?: 'email' | 'staff_whatsapp' | 'chat'; deliveryError?: string;
  /** Read-receipt aggregates (DRI-41, additive; absent on legacy deployments). */
  lastMessageAt?: string; hasStaffReply?: boolean; firstStaffReplyAt?: string | null; customerUnreadCount?: number;
};
export type RequestPage = { requests: OccasionRequest[]; page: number; pages: number; total: number };
export type HistoryMessage = { _id: string; sender: 'customer' | 'staff'; content: string; createdAt: string };
export type HistoryPage = { messages: HistoryMessage[]; olderCursor: string | null };
const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
async function request<T>(path: string, token: string, method = 'GET', payload?: unknown): Promise<T> {
  const response = await fetch(`${api}/api/occasion-requests${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...(payload ? { 'Content-Type': 'application/json' } : {}) }, body: payload ? JSON.stringify(payload) : undefined, cache: 'no-store', signal: AbortSignal.timeout(path.endsWith('/generate') ? 200000 : 30000) });
  if (!response.ok) throw new Error((await readError(response)).message || 'The request could not be completed.');
  return (await readJson<{ data: T }>(response)).data;
}
export const occasionRequestService = {
  list: (token: string, page = 1, status = '') => request<RequestPage>(`?page=${page}&status=${encodeURIComponent(status)}`, token),
  detail: (token: string, id: string) => request<OccasionRequest>(`/${id}`, token),
  save: (token: string, row: OccasionRequest, draft: string) => request<OccasionRequest>(`/${row._id}/draft`, token, 'PATCH', { revision: row.revision, draft }),
  generate: (token: string, row: OccasionRequest, instructions: string) => request<OccasionRequest>(`/${row._id}/generate`, token, 'POST', { revision: row.revision, instructions }),
  publish: (token: string, row: OccasionRequest, approved: boolean) => request<OccasionRequest>(`/${row._id}/publish`, token, 'POST', { revision: row.revision, approved }),
  history: (token: string, id: string, cursor = '') => request<HistoryPage>(`/${id}/messages${cursor ? `${cursor.startsWith('after=') ? '?' : '?before='}${cursor}` : ''}`, token),
  send: (token: string, row: OccasionRequest, approved: boolean) => request<OccasionRequest>(`/${row._id}/${row.channel === 'email' ? 'send' : 'record-whatsapp'}`, token, 'POST', { revision: row.revision, approved }),
  async download(token: string, row: OccasionRequest) {
    const response = await fetch(`${api}/api/occasion-requests/${row._id}/file`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error('The original attachment could not be downloaded.');
    const url = URL.createObjectURL(await response.blob()), anchor = document.createElement('a'); anchor.href = url; anchor.download = row.attachment?.name || 'drinks-list'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

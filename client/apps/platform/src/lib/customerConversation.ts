import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { API_URL } from './api';
export type ChatMessage = { _id: string; sender: 'customer' | 'staff'; content: string; createdAt: string };
export type ChatBrief = { _id: string; reference: string; occasion: string; city: string; date?: string; guests?: number; budget?: number; notes: string; preferences: string[]; items: { name: string; quantity: number }[]; status: string; createdAt: string; lastStaffReadAt?: string; attachment?: { name: string; size: number } };
export type Conversation = { request: ChatBrief; messages: ChatMessage[]; olderCursor: string | null };
/** One row of `GET /mine`. `customerUnreadCount` (server-computed staff
 * messages newer than `lastCustomerReadAt`), `lastMessageAt` and
 * `firstStaffReplyAt` are absent on legacy deployments. */
export type ChatRow = Pick<ChatBrief, '_id' | 'reference' | 'occasion' | 'status' | 'city' | 'createdAt'> & { customerUnreadCount?: number; lastMessageAt?: string; firstStaffReplyAt?: string | null; hasStaffReply?: boolean };
export type ChatPage = { requests: ChatRow[]; page: number; pages: number; total: number };
export type ChatCursor = { before?: string; after?: string };
async function call<T>(path: string, payload?: unknown): Promise<T> {
  const response = await fetchWithAuth(`${API_URL}/api/occasion-requests${path}`, { method: payload ? 'POST' : 'GET', body: payload ? JSON.stringify(payload) : undefined, cache: 'no-store', signal: AbortSignal.timeout(25000) });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.message || 'Conversation unavailable. Please retry.');
  return result.data as T;
}
/** Missing/legacy counts read as zero — badges only ever come from server truth. */
export const customerUnreadCountFor = (row: ChatRow): number => (typeof row.customerUnreadCount === 'number' && Number.isInteger(row.customerUnreadCount) && row.customerUnreadCount > 0 ? row.customerUnreadCount : 0);
const cursorQuery = (cursor?: ChatCursor) => (cursor?.before ? `?before=${encodeURIComponent(cursor.before)}` : cursor?.after ? `?after=${encodeURIComponent(cursor.after)}` : '');
export const customerConversation = {
  list: (page: number) => call<ChatPage>(`/mine?page=${page}`),
  read: (id: string, cursor?: ChatCursor) => call<Conversation>(`/${id}/messages${cursorQuery(cursor)}`),
  send: (id: string, content: string, messageKey: string) => call<ChatMessage>(`/${id}/messages`, { content, messageKey }),
  async download(id: string, name: string) {
    const response = await fetchWithAuth(`${API_URL}/api/occasion-requests/mine/${id}/file`, { signal: AbortSignal.timeout(25000) });
    if (!response.ok) throw new Error('The attachment could not be downloaded.');
    const url = URL.createObjectURL(await response.blob()), anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

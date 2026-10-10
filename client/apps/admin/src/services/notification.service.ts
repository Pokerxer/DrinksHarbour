export type NotificationCategory =
  | 'all'
  | 'stock'
  | 'performance'
  | 'suggestions'
  | 'products'
  | 'expiry';
export interface TenantNotice {
  _id: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
  actionUrl?: string;
  actionLabel?: string;
  metadata: Record<string, string | number>;
}
export interface NotificationPage {
  notifications: TenantNotice[];
  total: number;
  unreadCount: number;
  matchingUnreadCount?: number;
  page: number;
  limit: number;
}
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object';
export function isNotificationPage(data: unknown): data is NotificationPage {
  return (
    record(data) &&
    (data.matchingUnreadCount === undefined ||
      (typeof data.matchingUnreadCount === 'number' &&
        Number.isSafeInteger(data.matchingUnreadCount) &&
        data.matchingUnreadCount >= 0)) &&
    Array.isArray(data.notifications) &&
    ['total', 'unreadCount', 'page', 'limit'].every(
      (k) =>
        typeof data[k] === 'number' &&
        Number.isFinite(data[k]) &&
        Number(data[k]) >= 0
    ) &&
    data.notifications.every(
      (n) =>
        record(n) &&
        ['_id', 'title', 'message', 'createdAt', 'type', 'priority'].every(
          (k) => typeof n[k] === 'string'
        ) &&
        typeof n.isRead === 'boolean' &&
        record(n.metadata)
    )
  );
}
export async function notificationRequest<T = NotificationPage>(
  token: string,
  path = '',
  options: { method?: 'GET' | 'PATCH'; signal?: AbortSignal } = {}
): Promise<T> {
  if (!token) throw new Error('Sign in to view notifications.');
  const response = await fetch(`${API}/api/notifications${path}`, {
    method: options.method || 'GET',
    signal: options.signal,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error('Unable to load notifications. Please retry.');
  }
  if (!response.ok || !record(body) || body.success !== true)
    throw new Error(
      record(body) && typeof body.message === 'string'
        ? body.message
        : 'Unable to load notifications. Please retry.'
    );
  const data = body.data;
  if (
    options.method !== 'PATCH'
      ? !isNotificationPage(data)
      : path.split('?')[0] === '/read-all'
        ? !record(data) || typeof data.modifiedCount !== 'number'
        : !record(data) || data.isRead !== true
  )
    throw new Error('Invalid notification response. Please retry.');
  return data as T;
}

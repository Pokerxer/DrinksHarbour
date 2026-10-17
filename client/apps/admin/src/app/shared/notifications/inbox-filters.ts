import type {
  NotificationCategory,
  TenantNotice,
} from '@/services/notification.service';
export type InboxChip = 'unread' | 'urgent' | 'today' | 'week' | 'actionable';
export interface InboxFilters {
  category: NotificationCategory;
  chips: Set<InboxChip>;
  query: string;
  priority: string;
}
export const emptyFilters = (): InboxFilters => ({
  category: 'all',
  chips: new Set(),
  query: '',
  priority: '',
});
// Mirrors server/services/tenantNotificationRecipients.js CATEGORIES.
const categories: Record<string, NotificationCategory> = {
  low_stock_alert: 'stock',
  product_performance: 'performance',
  product_suggestion: 'suggestions',
  product_approved: 'products',
  product_rejected: 'products',
  batch_expiry_alert: 'expiry',
};
export function safeAction(url?: string) {
  if (!url || url.length > 500) return false;
  if (
    /^\/(?:inventory\/stock|sub-products(?:\/[a-f\d]{24})?|ecommerce\/reviews|products\/pending)\/?$/.test(
      url
    )
  )
    return true;
  if (!url.startsWith('/notifications/')) return false;
  const [path, query, ...rest] = url.split('?');
  if (
    rest.length ||
    url.includes('#') ||
    ![
      'stock',
      'warehouses',
      'performance',
      'forecasts',
      'restock',
      'vendor-orders',
      'products',
      'expiry',
      'promotions',
    ].includes(path.slice('/notifications/'.length))
  )
    return false;
  const seen = new Set<string>();
  let valid = true;
  new URLSearchParams(query || '').forEach((id, name) => {
    if (
      !['warehouseId', 'subProductId', 'sizeId'].includes(name) ||
      seen.has(name) ||
      !/^[a-f\d]{24}$/i.test(id)
    )
      valid = false;
    seen.add(name);
  });
  return valid;
}
const day = (value: string | Date) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Lagos',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date)
    : '';
};
const dayAge = (value: string, now: Date) => {
  const key = day(value);
  return key ? (Date.parse(day(now)) - Date.parse(key)) / 86400000 : Infinity;
};
export function filterNotices(
  notices: TenantNotice[],
  filters: InboxFilters,
  now = new Date()
) {
  const query = filters.query.trim().toLowerCase();
  return notices.filter(
    (n) =>
      (filters.category === 'all' || categories[n.type] === filters.category) &&
      (!query ||
        [
          n.title,
          n.message,
          n.type,
          n.actionLabel || '',
          ...[
            'productName',
            'sizeName',
            'warehouseName',
            'rejectionReason',
          ].map((key) => n.metadata?.[key] || ''),
        ]
          .join(' ')
          .toLowerCase()
          .includes(query)) &&
      (!filters.priority || n.priority === filters.priority) &&
      (!filters.chips.has('unread') || !n.isRead) &&
      (!filters.chips.has('actionable') || safeAction(n.actionUrl)) &&
      (!filters.chips.has('urgent') || n.priority === 'urgent') &&
      (!filters.chips.has('today') || dayAge(n.createdAt, now) === 0) &&
      (!filters.chips.has('week') ||
        (dayAge(n.createdAt, now) >= 0 && dayAge(n.createdAt, now) < 7))
  );
}
export function unreadByCategory(
  notices: TenantNotice[]
): Record<NotificationCategory, number> {
  const result = {
    all: 0,
    stock: 0,
    performance: 0,
    suggestions: 0,
    products: 0,
    expiry: 0,
  };
  for (const n of notices)
    if (!n.isRead) {
      result.all++;
      const category = categories[n.type];
      if (category) result[category]++;
    }
  return result;
}
export interface NoticeGroup {
  key: string;
  label: string;
  items: TenantNotice[];
  unread: number;
}
export function groupByDate(
  notices: TenantNotice[],
  now = new Date()
): NoticeGroup[] {
  const groups = ['today', 'yesterday', 'week', 'older'].map((key, i) => ({
    key,
    label: ['Today', 'Yesterday', 'This week', 'Older'][i],
    items: [] as TenantNotice[],
    unread: 0,
  }));
  for (const n of [...notices].sort(
    (a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)
  )) {
    const age = dayAge(n.createdAt, now);
    const group =
      groups[age === 0 ? 0 : age === 1 ? 1 : age >= 2 && age < 7 ? 2 : 3];
    group.items.push(n);
    if (!n.isRead) group.unread++;
  }
  return groups.filter((g) => g.items.length);
}
export function fullNoticeTimestamp(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString('en-NG', {
        timeZone: 'Africa/Lagos',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : 'Unknown date';
}
export function noticeTimestamp(value: string, now = new Date()) {
  const date = new Date(value),
    age = dayAge(value, now);
  if (!Number.isFinite(date.getTime())) return 'Unknown date';
  if (age === 0 || age === 1)
    return `${age === 0 ? 'Today' : 'Yesterday'} ${date.toLocaleTimeString('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', hour12: false })}`;
  return date.toLocaleDateString('en-NG', {
    timeZone: 'Africa/Lagos',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

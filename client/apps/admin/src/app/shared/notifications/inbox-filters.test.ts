import { expect, it } from 'vitest';
import {
  filterNotices,
  groupByDate,
  noticeTimestamp,
  safeAction,
  unreadByCategory,
  type InboxFilters,
  type InboxChip,
} from './inbox-filters';
import type { TenantNotice } from '@/services/notification.service';
const now = new Date('2026-10-08T12:00:00Z');
const base: TenantNotice = {
  _id: 'a',
  type: 'low_stock_alert',
  title: 'Wine',
  message: 'Running low',
  priority: 'urgent',
  isRead: false,
  createdAt: '2026-10-07T23:30:00Z',
  metadata: {},
  actionLabel: 'Review stock',
};
const filters: InboxFilters = {
  category: 'all',
  chips: new Set(),
  query: '',
  priority: '',
};
it('combines category, search, priority and Lagos date chips', () => {
  expect(
    filterNotices(
      [base],
      {
        ...filters,
        category: 'stock',
        query: 'REVIEW',
        priority: 'urgent',
        chips: new Set<InboxChip>(['today', 'unread']),
      },
      now
    )
  ).toEqual([base]);
  expect(
    filterNotices([base], { ...filters, category: 'products' }, now)
  ).toEqual([]);
  expect(
    filterNotices(
      [base],
      { ...filters, chips: new Set<InboxChip>(['urgent']), priority: 'low' },
      now
    )
  ).toEqual([]);
  expect(
    filterNotices(
      [{ ...base, createdAt: '2026-09-01' }],
      { ...filters, chips: new Set<InboxChip>(['week']) },
      now
    )
  ).toEqual([]);
});
it('groups descending dates and handles malformed timestamps', () => {
  const groups = groupByDate(
    [
      base,
      { ...base, _id: 'b', createdAt: 'bad' },
      { ...base, _id: 'c', createdAt: '2026-10-07T08:00:00Z' },
      { ...base, _id: 'd', createdAt: '2026-10-04T08:00:00Z' },
    ],
    now
  );
  expect(groups.map((g) => g.key)).toEqual([
    'today',
    'yesterday',
    'week',
    'older',
  ]);
  expect(noticeTimestamp(base.createdAt, now)).toBe('Today 00:30');
  expect(noticeTimestamp('bad', now)).toBe('Unknown date');
});
it('counts unread by category and permits only approved internal destinations', () => {
  expect(
    unreadByCategory([
      base,
      { ...base, type: 'product_approved', _id: 'b' },
      { ...base, isRead: true, _id: 'c' },
    ])
  ).toMatchObject({ all: 2, stock: 1, products: 1 });
  expect(safeAction('/inventory/stock')).toBe(true);
  expect(safeAction('//evil.test')).toBe(false);
  expect(safeAction('/inventory/stock?next=evil')).toBe(false);
});
it.each([
  ['low_stock_alert', 'stock'],
  ['product_performance', 'performance'],
  ['product_suggestion', 'suggestions'],
  ['product_approved', 'products'],
  ['product_rejected', 'products'],
  ['batch_expiry_alert', 'expiry'],
] as const)('mirrors server category mapping for %s', (type, category) => {
  expect(
    filterNotices([{ ...base, type }], { ...filters, category }, now)
  ).toHaveLength(1);
  expect(unreadByCategory([{ ...base, type }])[category]).toBe(1);
});
it.each(['WINE', 'running LOW', 'LOW_STOCK_ALERT', 'review STOCK'])(
  'searches notice content without case sensitivity: %s',
  (query) => {
    expect(filterNotices([base], { ...filters, query }, now)).toHaveLength(1);
  }
);
it('excludes read notices, rejects invalid dates in date chips and sorts newest first', () => {
  expect(
    filterNotices(
      [{ ...base, isRead: true }],
      { ...filters, chips: new Set<InboxChip>(['unread']) },
      now
    )
  ).toEqual([]);
  expect(
    filterNotices(
      [{ ...base, createdAt: 'bad' }],
      { ...filters, chips: new Set<InboxChip>(['today']) },
      now
    )
  ).toEqual([]);
  expect(
    groupByDate(
      [base, { ...base, _id: 'later', createdAt: '2026-10-08T09:00:00Z' }],
      now
    )[0].items.map((n) => n._id)
  ).toEqual(['later', 'a']);
  expect(
    filterNotices([{ ...base, type: 'platform_notice' }], filters, now)
  ).toHaveLength(1);
});

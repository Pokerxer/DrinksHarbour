'use client';
import NotificationTimeframe from './notification-timeframe';
import { useEffect, useState } from 'react';
import NotificationFeatureHeader from './notification-feature-header';
import NotificationSummaryCards from './notification-summary-cards';
import NotificationProductControls from './notification-product-controls';
import { useNotifications } from './use-notifications';
import NotificationList from './notification-list';
import ProductUpdatesList from './products/product-updates-list';
import ExpiryAlertsList from './expiry/expiry-alerts-list';
import type { NotificationCategory } from '@/services/notification.service';
export default function NotificationCategoryPage({
  category,
  title,
  description,
}: {
  category: NotificationCategory;
  title: string;
  description: string;
}) {
  const [range, setRange] = useState({ startDate: '', endDate: '' });
  const [decision, setDecision] = useState<
    '' | 'product_approved' | 'product_rejected'
  >('');
  const [page, setPage] = useState(1),
    [unreadOnly, setUnread] = useState(false),
    [query, setQuery] = useState(''),
    [search, setSearch] = useState(''),
    [sort, setSort] = useState<
      'newest' | 'oldest' | 'expiry_soonest' | 'expiry_latest'
    >(category === 'expiry' ? 'expiry_soonest' : 'newest');
  const [expiryStatus, setExpiryStatus] = useState<
    'all' | 'expired' | 'soon' | 'later' | 'quarantined'
  >('all');
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  const inbox = useNotifications({
    category,
    ...(category === 'expiry' ? { expiryStatus } : {}),
    ...(category === 'products' && decision ? { type: decision } : {}),
    ...(range.startDate ? range : {}),
    page,
    limit: 50,
    unreadOnly,
    search,
    sort,
  });
  useEffect(() => {
    if (
      !inbox.loading &&
      !inbox.error &&
      page > Math.max(1, Math.ceil(inbox.data.total / 50))
    )
      setPage(Math.max(1, Math.ceil(inbox.data.total / 50)));
  }, [inbox.loading, inbox.error, inbox.data.total, page]);
  return (
    <section className="space-y-5 pb-8">
      <NotificationFeatureHeader
        title={title}
        description={description}
        warehouse="Your notifications"
        period={
          category === 'expiry'
            ? 'Batch expiry dates · daily scan at 02:00 Lagos time'
            : 'Recorded updates for your account'
        }
        loading={inbox.loading}
        refresh={inbox.refresh}
        refreshLabel="Refresh notifications"
      />
      <NotificationTimeframe
        {...range}
        allowFuture={category === 'expiry'}
        title={category === 'expiry' ? 'Expiry dates' : 'Timeframe'}
        disabled={inbox.loading || inbox.busy}
        onApply={(startDate, endDate) => {
          setRange({ startDate, endDate });
          setPage(1);
        }}
      />
      <NotificationSummaryCards
        active={unreadOnly ? 'unread' : 'all'}
        onSelect={(value) => {
          setUnread(value === 'unread');
          setPage(1);
        }}
        cards={[
          {
            valueId: 'all',
            label: 'Matching notices',
            value: inbox.data.total,
            detail: 'Matches the current search and read filter',
          },
          {
            valueId: 'unread',
            label: 'Unread notices',
            value:
              inbox.data.matchingUnreadCount ??
              inbox.data.notifications.filter((n) => !n.isRead).length,
            detail:
              inbox.data.matchingUnreadCount === undefined
                ? 'Unread on this page · click to filter all notices'
                : 'Unread across all matching updates',
          },
        ]}
      />
      <NotificationProductControls
        label="Search notifications"
        query={query}
        setQuery={(value) => setQuery(value.slice(0, 200))}
        status={unreadOnly ? 'unread' : 'all'}
        setStatus={(value) => {
          setUnread(value === 'unread');
          setPage(1);
        }}
        statuses={[
          ['all', 'All notices'],
          ['unread', 'Unread only'],
        ]}
        sort={sort}
        setSort={(value) => {
          setSort(value as typeof sort);
          setPage(1);
        }}
        sorts={[
          ...(category === 'expiry'
            ? ([
                ['expiry_soonest', 'Soonest expiry first'],
                ['expiry_latest', 'Latest expiry first'],
              ] as Array<[string, string]>)
            : []),
          ['newest', 'Newest first'],
          ['oldest', 'Oldest first'],
        ]}
        count={inbox.data.total}
        reset={() => {
          setQuery('');
          setSearch('');
          setUnread(false);
          setSort(category === 'expiry' ? 'expiry_soonest' : 'newest');
          setExpiryStatus('all');
          setDecision('');
          setPage(1);
        }}
      >
        {category === 'expiry' && (
          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
            Expiry status
            <select
              aria-label="Expiry status"
              value={expiryStatus}
              onChange={(e) => {
                setExpiryStatus(e.target.value as typeof expiryStatus);
                setPage(1);
              }}
              className="h-11 rounded-xl border border-gray-200 px-3 text-sm font-normal"
            >
              <option value="all">All expiry alerts</option>
              <option value="expired">Expired</option>
              <option value="soon">Within 30 days</option>
              <option value="later">More than 30 days</option>
              <option value="quarantined">Quarantined</option>
            </select>
          </label>
        )}
        {category === 'products' && (
          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
            Decision
            <select
              aria-label="Product decision"
              value={decision}
              onChange={(e) => {
                setDecision(e.target.value as typeof decision);
                setPage(1);
              }}
              className="h-11 rounded-xl border border-gray-200 px-3 text-sm font-normal"
            >
              <option value="">All decisions</option>
              <option value="product_approved">Approved</option>
              <option value="product_rejected">Needs changes</option>
            </select>
          </label>
        )}
      </NotificationProductControls>
      <div className="overflow-hidden rounded-2xl border bg-white">
        {category === 'products' ? (
          <ProductUpdatesList
            key={inbox.scope}
            notifications={inbox.data.notifications}
            loading={inbox.loading}
            error={inbox.error}
            busy={inbox.busy}
            onRetry={inbox.refresh}
            onRead={(id) => void inbox.markRead(id)}
          />
        ) : category === 'expiry' ? (
          <ExpiryAlertsList
            key={inbox.scope}
            notifications={inbox.data.notifications}
            loading={inbox.loading}
            error={inbox.error}
            busy={inbox.busy}
            onRetry={inbox.refresh}
            onRead={(id) => void inbox.markRead(id)}
          />
        ) : (
          <NotificationList
            notifications={inbox.data.notifications}
            loading={inbox.loading}
            error={inbox.error}
            busy={inbox.busy}
            onRetry={inbox.refresh}
            onRead={(id) => void inbox.markRead(id)}
          />
        )}
      </div>
      <div className="flex items-center justify-end gap-4 text-sm">
        <button
          disabled={page === 1 || inbox.loading}
          onClick={() => setPage((p) => p - 1)}
          className="disabled:opacity-40"
        >
          Previous
        </button>
        <span>Page {page}</span>
        <button
          disabled={page * 50 >= inbox.data.total || inbox.loading}
          onClick={() => setPage((p) => p + 1)}
          className="disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </section>
  );
}

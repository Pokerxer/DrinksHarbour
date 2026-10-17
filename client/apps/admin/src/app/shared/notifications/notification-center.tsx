'use client';
import NotificationTimeframe from './notification-timeframe';
import { useCallback, useEffect, useState } from 'react';
import { PiBell } from 'react-icons/pi';
import { useNotificationInbox } from './use-notification-inbox';
import {
  emptyFilters,
  filterNotices,
  groupByDate,
  unreadByCategory,
  type InboxChip,
} from './inbox-filters';
import NotificationHero from './notification-hero';
import NotificationCoverage from './notification-coverage';
import NotificationStatCards from './notification-stat-cards';
import NotificationToolbar, { hasFilters } from './notification-toolbar';
import NotificationSelection from './notification-selection';
import NotificationGroup from './notification-group';
import NotificationDetailPanel from './notification-detail-panel';
import { groupByUrgency } from './urgency-groups';
function toggleSet(values: Set<string>, key: string) {
  const result = new Set(values);
  result.has(key) ? result.delete(key) : result.add(key);
  return result;
}
export default function NotificationCenter() {
  const [range, setRange] = useState({ startDate: '', endDate: '' });
  const inbox = useNotificationInbox(range);
  return (
    <Inbox
      key={inbox.scope}
      inbox={inbox}
      range={range}
      setRange={(startDate, endDate) => setRange({ startDate, endDate })}
    />
  );
}
function Inbox({
  inbox,
  range,
  setRange,
}: {
  inbox: ReturnType<typeof useNotificationInbox>;
  range: { startDate: string; endDate: string };
  setRange: (start: string, end: string) => void;
}) {
  const [filters, setFilters] = useState(emptyFilters),
    [order, setOrder] = useState('date'),
    [checked, setChecked] = useState(new Set<string>()),
    [collapsed, setCollapsed] = useState(new Set<string>()),
    [selected, setSelected] = useState<string | null>(null);
  const notices = inbox.data.notifications,
    rows = filterNotices(notices, filters),
    groups = order === 'urgency' ? groupByUrgency(rows) : groupByDate(rows);
  const selectedNotice = notices.find((n) => n._id === selected) || null;
  useEffect(() => {
    if (selected && !selectedNotice) setSelected(null);
  }, [selected, selectedNotice]);
  const selectedIds = rows.filter((n) => checked.has(n._id)).map((n) => n._id);
  const unreadRows = rows.filter((n) => !n.isRead);
  const selectedUnread = unreadRows
    .filter((n) => checked.has(n._id))
    .map((n) => n._id);
  const allChecked =
    unreadRows.length > 0 && selectedUnread.length === unreadRows.length;
  const toggleAll = () =>
    setChecked((current) => {
      const next = new Set(current);
      unreadRows.forEach((n) => {
        if (allChecked) next.delete(n._id);
        else next.add(n._id);
      });
      return next;
    });
  const changeFilters = (next: typeof filters) => {
    setFilters(next);
    setSelected(null);
    setChecked(new Set());
  };
  const close = useCallback(() => setSelected(null), []);
  const select = (id: string) => {
    setSelected(id);
    void inbox.markRead(id);
  };
  return (
    <section className="space-y-6 pb-8">
      <NotificationHero
        unread={inbox.data.unreadCount}
        loading={inbox.loading}
        busy={inbox.busy}
        refresh={inbox.refresh}
        markAll={inbox.markAllRead}
      />
      <NotificationTimeframe
        {...range}
        onApply={setRange}
        disabled={inbox.loading || inbox.busy}
      />
      <NotificationStatCards
        notices={notices}
        total={inbox.data.total}
        scoped={!!range.startDate}
        unread={inbox.data.unreadCount}
        active={
          filters.chips.has('actionable')
            ? 'Actionable'
            : filters.chips.has('urgent')
              ? 'Urgent'
              : filters.chips.has('unread')
                ? 'Unread'
                : hasFilters(filters)
                  ? ''
                  : 'Total notices'
        }
        onSelect={(value) =>
          changeFilters({
            ...emptyFilters(),
            chips: new Set<InboxChip>(
              value === 'Unread'
                ? ['unread']
                : value === 'Urgent'
                  ? ['urgent']
                  : value === 'Actionable'
                    ? ['actionable']
                    : []
            ),
          })
        }
      />
      {inbox.error && (
        <div
          role={inbox.error.startsWith('Sign in') ? 'status' : 'alert'}
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-sm ${inbox.error.startsWith('Sign in') ? 'border-gray-200 bg-gray-50 text-gray-700' : 'border-red-200 bg-red-50 text-red-700'}`}
        >
          <span>{inbox.error}</span>
          {!inbox.error.startsWith('Sign in') && (
            <button
              disabled={inbox.loading || inbox.busy}
              onClick={inbox.refresh}
              className="font-bold underline disabled:opacity-50"
            >
              Retry
            </button>
          )}
        </div>
      )}
      <NotificationCoverage
        loaded={notices.length}
        total={inbox.data.total}
        loading={inbox.loading}
        failed={!!inbox.error}
      />
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <NotificationToolbar
          order={order}
          setOrder={setOrder}
          filters={filters}
          onChange={changeFilters}
          counts={unreadByCategory(notices)}
          count={rows.length}
          total={inbox.data.total}
          busy={inbox.busy}
          loading={inbox.loading}
          refresh={inbox.refresh}
        />
        <NotificationSelection
          unread={unreadRows.length}
          selected={selectedIds.length}
          selectedUnread={selectedUnread.length}
          busy={inbox.busy}
          loading={inbox.loading}
          busyLabel={inbox.busyLabel}
          allChecked={
            allChecked ? true : selectedUnread.length ? 'mixed' : false
          }
          toggleAll={toggleAll}
          clear={() => setChecked(new Set())}
          mark={() => void inbox.markManyRead(selectedUnread)}
        />
        <div className="relative flex min-h-[480px]">
          <div
            role="tabpanel"
            id="notification-results"
            aria-labelledby={`notice-tab-${filters.category}`}
            className={`min-w-0 flex-1 ${selectedNotice ? 'lg:w-1/2 lg:flex-none' : ''}`}
          >
            {inbox.loading ? (
              <div
                role="status"
                aria-label="Loading notifications"
                className="divide-y divide-gray-100"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <div key={i} className="flex animate-pulse gap-4 p-5">
                    <span className="h-10 w-10 rounded-xl bg-gray-100" />
                    <span className="flex-1 space-y-2">
                      <span className="block h-3 w-2/3 rounded bg-gray-100" />
                      <span className="block h-3 w-1/2 rounded bg-gray-100" />
                    </span>
                  </div>
                ))}
              </div>
            ) : groups.length ? (
              groups.map((group) => (
                <NotificationGroup
                  key={group.key}
                  group={group}
                  collapsed={collapsed.has(group.key)}
                  toggleCollapse={() =>
                    setCollapsed((s) => toggleSet(s, group.key))
                  }
                  checked={checked}
                  selected={selectedNotice?._id || null}
                  toggle={(id) => setChecked((s) => toggleSet(s, id))}
                  select={select}
                />
              ))
            ) : (
              <div className="flex min-h-[480px] flex-col items-center justify-center gap-3 p-6 text-center">
                <span className="rounded-2xl bg-gray-100 p-4">
                  <PiBell className="h-8 w-8 text-gray-400" />
                </span>
                <p className="font-bold text-gray-800">
                  {inbox.error
                    ? inbox.error.startsWith('Sign in')
                      ? 'Sign in to view your inbox'
                      : 'Notifications unavailable'
                    : hasFilters(filters)
                      ? 'No matching notifications'
                      : 'You’re all caught up'}
                </p>
                <p className="text-sm text-gray-500">
                  {inbox.error
                    ? 'Your updates will appear once access is restored.'
                    : hasFilters(filters)
                      ? 'Try a different search or clear your filters.'
                      : 'New updates will appear here.'}
                </p>
                {hasFilters(filters) && (
                  <button
                    onClick={() => changeFilters(emptyFilters())}
                    className="text-sm font-bold text-[#b20202] underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>
          <NotificationDetailPanel notice={selectedNotice} close={close} />
        </div>
      </div>
    </section>
  );
}

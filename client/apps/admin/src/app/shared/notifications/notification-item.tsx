'use client';
import Link from 'next/link';
import { safeAction } from './inbox-filters';
import { Package, TrendingUp, Lightbulb, Clock, Check } from 'lucide-react';
import type { TenantNotice } from '@/services/notification.service';
const icons = {
  low_stock_alert: Package,
  product_performance: TrendingUp,
  product_suggestion: Lightbulb,
  batch_expiry_alert: Clock,
};
function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString('en-NG', {
        day: 'numeric',
        month: 'short',
        timeZone: 'Africa/Lagos',
      })
    : '';
}
export default function NotificationItem({
  notice,
  busy,
  onRead,
  onOpen,
}: {
  notice: TenantNotice;
  busy: boolean;
  onRead: (id: string) => void;
  onOpen?: (id: string) => void;
}) {
  const Icon = icons[notice.type as keyof typeof icons] || Package;
  const urgent = notice.priority === 'urgent';
  const start = notice.metadata.periodStart,
    end = notice.metadata.periodEnd;
  const periodStart = typeof start === 'string' ? dateLabel(start) : '';
  const periodEnd =
    typeof end === 'string' && Number.isFinite(Date.parse(end))
      ? dateLabel(new Date(Date.parse(end) - 1).toISOString())
      : '';
  return (
    <li
      className={`flex gap-3 border-b border-gray-100 p-4 last:border-0 ${notice.isRead ? '' : 'bg-gray-50/70'}`}
    >
      <span
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${urgent ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'}`}
      >
        <Icon size={18} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900">{notice.title}</p>
          <span className="shrink-0 text-xs text-gray-500">
            {notice.isRead ? 'Read' : 'Unread'}
          </span>
        </div>
        {urgent && (
          <span className="text-xs font-medium text-red-600">Urgent</span>
        )}
        <p className="mt-1 whitespace-pre-line break-words text-sm text-gray-600">
          {notice.message}
        </p>
        {periodStart && periodEnd && (
          <p className="mt-2 text-xs text-gray-500">
            Sales period: {periodStart} – {periodEnd}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <time dateTime={notice.createdAt} className="text-gray-500">
            {dateLabel(notice.createdAt)}
          </time>
          {onOpen && (
            <button
              type="button"
              onClick={() => onOpen(notice._id)}
              className="font-medium text-primary hover:underline"
            >
              View update details
            </button>
          )}
          {safeAction(notice.actionUrl) && (
            <Link
              href={notice.actionUrl!}
              className="font-medium text-primary hover:underline"
            >
              {notice.actionLabel || 'View details'}
            </Link>
          )}
          {!notice.isRead && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onRead(notice._id)}
              className="inline-flex items-center gap-1 font-medium text-gray-700 hover:underline disabled:opacity-50"
            >
              <Check size={13} aria-hidden="true" />
              Mark as read
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

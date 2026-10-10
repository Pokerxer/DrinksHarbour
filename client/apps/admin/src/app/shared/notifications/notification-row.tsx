'use client';
import {
  PiPackage,
  PiTrendUp,
  PiLightbulb,
  PiClock,
  PiBell,
  PiSquare,
  PiCheckSquare,
} from 'react-icons/pi';
import type { TenantNotice } from '@/services/notification.service';
import { noticeAppearance } from './notice-presentation';
import { noticeTimestamp } from './inbox-filters';
export const noticeIcons = {
  low_stock_alert: PiPackage,
  product_performance: PiTrendUp,
  product_suggestion: PiLightbulb,
  batch_expiry_alert: PiClock,
  product_approved: PiPackage,
  product_rejected: PiPackage,
};
export function PriorityBadge({ priority }: { priority: string }) {
  return priority === 'urgent' || priority === 'high' ? (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${priority === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}
    >
      {priority}
    </span>
  ) : null;
}
export default function NotificationRow({
  notice,
  checked,
  active,
  toggle,
  select,
}: {
  notice: TenantNotice;
  checked: boolean;
  active: boolean;
  toggle: () => void;
  select: () => void;
}) {
  const appearance = noticeAppearance(notice.type);
  const Icon = noticeIcons[notice.type as keyof typeof noticeIcons] || PiBell;
  return (
    <li
      className={`flex items-center gap-3 border-b border-l-2 border-b-gray-100 px-4 py-4 last:border-b-0 ${!notice.isRead ? 'border-l-[#b20202] bg-red-50/50' : 'border-l-transparent'} ${active ? 'ring-1 ring-inset ring-red-200' : ''}`}
    >
      <button
        role="checkbox"
        aria-checked={checked}
        aria-label={`Select ${notice.title}`}
        onClick={toggle}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-[#b20202] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b20202]"
      >
        {checked ? (
          <PiCheckSquare className="h-5 w-5 text-[#b20202]" />
        ) : (
          <PiSquare className="h-5 w-5" />
        )}
      </button>
      <button
        onClick={select}
        aria-label={`Open ${notice.title}`}
        aria-expanded={active}
        className="flex min-w-0 flex-1 flex-wrap items-center gap-3 text-left focus-visible:rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b20202] sm:flex-nowrap"
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${notice.priority === 'urgent' ? 'bg-red-100 text-[#b20202]' : appearance.tile}`}
        >
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span
              className={`text-sm text-gray-900 ${notice.isRead ? 'font-medium' : 'font-bold'}`}
            >
              {notice.title}
            </span>
            <PriorityBadge priority={notice.priority} />
          </span>
          <span className="mt-1 block text-[10px] font-semibold text-gray-500">
            {appearance.label}
          </span>
          <span className="mt-1 block truncate text-xs text-gray-500">
            {notice.message}
          </span>
        </span>
        <span className="flex w-full shrink-0 items-center justify-between gap-1 sm:w-auto sm:flex-col sm:items-end">
          <span
            className={`text-[10px] font-semibold ${notice.isRead ? 'text-gray-400' : 'text-[#b20202]'}`}
          >
            {notice.isRead ? 'Read' : 'Unread'}
          </span>
          <time
            dateTime={
              Number.isFinite(Date.parse(notice.createdAt))
                ? notice.createdAt
                : undefined
            }
            className="shrink-0 text-[10px] tabular-nums text-gray-500 sm:text-[11px]"
          >
            {noticeTimestamp(notice.createdAt)}
          </time>
        </span>
      </button>
    </li>
  );
}

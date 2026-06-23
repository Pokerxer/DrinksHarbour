'use client';

import { useEffect, useRef, useState } from 'react';
import { posApi } from '@/app/shared/point-of-sale/api';
import {
  usePOSAuth,
  usePOSNotifications,
} from '@/app/shared/point-of-sale/store';
import { POSNotification } from '@/app/shared/point-of-sale/types';

const POLL_INTERVAL_MS = 30_000;

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatAmount(n: number) {
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function POSNotificationBell() {
  const { token } = usePOSAuth();
  const { notifications, unreadCount, markAllSeen, addNotifications } =
    usePOSNotifications();
  const [open, setOpen] = useState(false);
  const sinceRef = useRef<string>(
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  );
  const panelRef = useRef<HTMLDivElement>(null);

  // Poll for new notifications every 30s
  useEffect(() => {
    if (!token) return;

    async function poll() {
      try {
        const data = await posApi.getNotifications(token!, sinceRef.current);
        if (data.notifications.length) {
          addNotifications(data.notifications);
          sinceRef.current = new Date().toISOString();
        }
      } catch {
        // silent — network blips shouldn't break the sell page
      }
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function handleToggle() {
    if (!open) markAllSeen();
    setOpen((v) => !v);
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        type="button"
        onClick={handleToggle}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100"
        title="Online orders"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#b20202] px-1 text-[10px] font-bold leading-none text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Online Orders
              </p>
              <p className="text-xs text-gray-400">
                Purchases from your web store
              </p>
            </div>
            {notifications.some((n) => !n.seen) && (
              <button
                type="button"
                onClick={markAllSeen}
                className="text-xs font-medium text-[#b20202] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="mb-2 text-gray-300"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <p className="text-sm font-medium text-gray-400">
                  No online orders yet
                </p>
                <p className="mt-0.5 text-xs text-gray-300">
                  New orders will appear here
                </p>
              </div>
            ) : (
              notifications.map((n) => <NotificationRow key={n._id} n={n} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationRow({ n }: { n: POSNotification & { seen?: boolean } }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setExpanded((v) => !v)}
      className={`w-full border-b border-gray-50 px-4 py-3 text-left transition-colors last:border-0 hover:bg-gray-50 ${!n.seen ? 'bg-red-50/40' : ''}`}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${!n.seen ? 'bg-[#b20202]' : 'bg-gray-200'}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-1">
            <p className="truncate text-sm font-semibold text-gray-900">
              {n.orderNumber}
            </p>
            <span className="shrink-0 text-[11px] text-gray-400">
              {formatTime(n.placedAt)}
            </span>
          </div>
          <p className="text-xs text-gray-500">
            {n.customer} · {n.itemCount} item{n.itemCount !== 1 ? 's' : ''}
          </p>
          <p className="mt-0.5 text-sm font-bold text-[#b20202]">
            {formatAmount(n.total)}
          </p>

          {expanded && n.items.length > 0 && (
            <ul className="mt-2 space-y-0.5 rounded-lg bg-gray-50 px-2 py-1.5">
              {n.items.map((item, i) => (
                <li
                  key={i}
                  className="flex justify-between text-xs text-gray-600"
                >
                  <span className="truncate">
                    {item.qty}× {item.name}
                  </span>
                  <span className="ml-2 shrink-0 font-medium">
                    {formatAmount(item.subtotal)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </button>
  );
}

'use client';
import { Bell } from 'lucide-react';
import type { TenantNotice } from '@/services/notification.service';
import NotificationItem from './notification-item';
export default function NotificationList({
  notifications,
  loading,
  error,
  busy,
  onRetry,
  onRead,
  onOpen,
}: {
  notifications: TenantNotice[];
  loading: boolean;
  error: string;
  busy: boolean;
  onRetry: () => void;
  onRead: (id: string) => void;
  onOpen?: (id: string) => void;
}) {
  return (
    <div aria-busy={loading}>
      {error && (
        <div
          role="alert"
          className="m-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
          <button
            type="button"
            onClick={onRetry}
            className="ml-3 font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}
      {loading && notifications.length === 0 ? (
        <p role="status" className="p-8 text-center text-sm text-gray-500">
          Loading notifications…
        </p>
      ) : notifications.length === 0 && !error ? (
        <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
          <Bell size={28} className="text-gray-400" aria-hidden="true" />
          <p className="font-medium text-gray-800">You’re all caught up</p>
          <p className="text-sm text-gray-500">
            Product alerts and useful next steps will appear here.
          </p>
        </div>
      ) : (
        <ul aria-label="Notifications">
          {notifications.map((notice) => (
            <NotificationItem
              key={notice._id}
              notice={notice}
              busy={busy}
              onRead={onRead}
              onOpen={onOpen}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

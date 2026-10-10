'use client';
import Link from 'next/link';
import {
  cloneElement,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Popover } from 'rizzui';
import { useMedia } from '@core/hooks/use-media';
import { useNotifications } from '@/app/shared/notifications/use-notifications';
import NotificationList from '@/app/shared/notifications/notification-list';
export default function NotificationDropdown({
  children,
}: {
  children: ReactElement<{ children?: ReactNode; 'aria-label'?: string }>;
}) {
  const [isOpen, setIsOpen] = useState(false),
    isMobile = useMedia('(max-width: 480px)', false);
  const inbox = useNotifications({ limit: 8 });
  const count = inbox.data.unreadCount;
  const trigger = cloneElement(children, {
    'aria-label': `Notifications${count ? `, ${count} unread` : ''}`,
    children: (
      <>
        {children.props.children}
        {count > 0 && (
          <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </>
    ),
  });
  return (
    <Popover
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      shadow="sm"
      placement={isMobile ? 'bottom' : 'bottom-end'}
    >
      <Popover.Trigger>{trigger}</Popover.Trigger>
      <Popover.Content className="z-[9999] p-0 dark:bg-gray-100">
        <div className="w-[min(360px,calc(100vw-24px))] text-left rtl:text-right">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h2 className="text-base font-semibold">Notifications</h2>
            <button
              type="button"
              onClick={inbox.markAllRead}
              disabled={inbox.busy || !count}
              className="text-xs font-medium text-gray-600 disabled:opacity-40"
            >
              Mark all as read
            </button>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            <NotificationList
              notifications={inbox.data.notifications}
              loading={inbox.loading}
              error={inbox.error}
              busy={inbox.busy}
              onRetry={inbox.refresh}
              onRead={inbox.markRead}
            />
          </div>
          <Link
            href="/notifications"
            onClick={() => setIsOpen(false)}
            className="block border-t border-gray-100 p-3 text-center text-sm font-medium hover:underline"
          >
            View all notifications
          </Link>
        </div>
      </Popover.Content>
    </Popover>
  );
}

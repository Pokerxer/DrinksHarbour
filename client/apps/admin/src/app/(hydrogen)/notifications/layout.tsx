import { Suspense } from 'react';
import NotificationsSectionNav from '@/app/shared/notifications/notifications-section-nav';
export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <NotificationsSectionNav />
      <Suspense fallback={<p role="status">Loading notifications…</p>}>
        {children}
      </Suspense>
    </>
  );
}

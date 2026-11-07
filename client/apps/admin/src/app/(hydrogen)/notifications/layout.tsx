import { Suspense } from 'react';
import NotificationsSectionNav from '@/app/shared/notifications/notifications-section-nav';

/**
 * POS-style module chrome: nav header + content canvas. Responsive rules
 * (brand text hiding / mobile Menu button) live in ModuleNavHeader, rendered
 * via NotificationsSectionNav (which applies the permission-gated tabs).
 */
export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-4 -mt-2 flex flex-col md:-mx-5 lg:-mx-6 3xl:-mx-8">
      <div className="px-4 md:px-5 lg:px-6 3xl:px-8">
        <NotificationsSectionNav />
      </div>
      <div className="flex flex-1 flex-col px-4 pb-10 pt-6 md:px-10 lg:px-14">
        <Suspense fallback={<p role="status">Loading notifications…</p>}>
          {children}
        </Suspense>
      </div>
    </div>
  );
}

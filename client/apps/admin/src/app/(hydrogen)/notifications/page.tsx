import { metaObject } from '@/config/site.config';
import NotificationCenter from '@/app/shared/notifications/notification-center';
export const metadata = { ...metaObject('Notifications') };
export default function NotificationsPage() {
  return <NotificationCenter />;
}

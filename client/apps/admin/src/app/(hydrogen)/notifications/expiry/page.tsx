import { metaObject } from '@/config/site.config';
import NotificationCategoryPage from '@/app/shared/notifications/notification-category-page';
export const metadata = { ...metaObject('Expiry alerts') };
export default function Page() {
  return (
    <NotificationCategoryPage
      category="expiry"
      title="Expiry alerts"
      description="Review products and batches nearing their expiry dates."
    />
  );
}

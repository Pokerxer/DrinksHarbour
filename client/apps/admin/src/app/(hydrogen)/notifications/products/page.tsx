import { metaObject } from '@/config/site.config';
import NotificationCategoryPage from '@/app/shared/notifications/notification-category-page';
export const metadata = { ...metaObject('Product updates') };
export default function Page() {
  return (
    <NotificationCategoryPage
      category="products"
      title="Product updates"
      description="Approval decisions and required changes for your beverage listings."
    />
  );
}

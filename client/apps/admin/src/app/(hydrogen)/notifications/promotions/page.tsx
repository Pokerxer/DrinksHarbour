import { metaObject } from '@/config/site.config';
import PromotionPage from '@/app/shared/notifications/promotions/promotion-page';
export const metadata = { ...metaObject('Promotion suggestions') };
export default function Page() {
  return <PromotionPage />;
}

import BannerAnalyticsDashboard from '@/app/shared/ecommerce/banner/banner-list/analytics-dashboard';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Banner Analytics'),
};

export default function BannerAnalyticsPage() {
  return <BannerAnalyticsDashboard />;
}
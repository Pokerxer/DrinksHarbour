import { metaObject } from '@/config/site.config';
import InsightPage from '@/app/shared/notifications/insights/insight-page';
export const metadata = { ...metaObject('Low-stock alerts') };
export default function Page() {
  return <InsightPage mode="stock" />;
}

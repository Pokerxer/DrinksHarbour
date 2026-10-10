import { metaObject } from '@/config/site.config';
import PerformancePage from '@/app/shared/notifications/performance/performance-page';
export const metadata = { ...metaObject('Sales performance') };
export default function Page() {
  return <PerformancePage />;
}

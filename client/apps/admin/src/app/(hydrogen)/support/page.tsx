import SupportOverview from '@/app/shared/support/overview';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Support'),
};

export default function SupportDashboardPage() {
  return <SupportOverview />;
}

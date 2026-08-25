import dynamic from 'next/dynamic';
import { metaObject } from '@/config/site.config';

const AccountingDashboard = dynamic(
  () => import('@/app/shared/accounting/accounting-dashboard')
);

export const metadata = { ...metaObject('Accounting') };

export default function AccountingPage() {
  return <AccountingDashboard />;
}

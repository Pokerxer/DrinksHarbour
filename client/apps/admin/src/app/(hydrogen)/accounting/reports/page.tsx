import dynamic from 'next/dynamic';
import { metaObject } from '@/config/site.config';

const AccountingReports = dynamic(
  () => import('@/app/shared/accounting/accounting-reports')
);

export const metadata = { ...metaObject('Accounting — Reports') };

export default function AccountingReportsPage() {
  return <AccountingReports />;
}

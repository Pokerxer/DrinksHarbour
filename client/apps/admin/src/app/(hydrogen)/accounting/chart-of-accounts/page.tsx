import dynamic from 'next/dynamic';
import { metaObject } from '@/config/site.config';

const AccountingChartOfAccounts = dynamic(
  () => import('@/app/shared/accounting/accounting-chart-of-accounts')
);

export const metadata = { ...metaObject('Accounting — Chart of Accounts') };

export default function ChartOfAccountsPage() {
  return <AccountingChartOfAccounts />;
}

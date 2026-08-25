import dynamic from 'next/dynamic';
import { metaObject } from '@/config/site.config';

const CustomersView = dynamic(() =>
  import('@/app/shared/accounting/accounting-directories').then((m) => m.CustomersView)
);
import AccountingPageShell from '@/app/shared/accounting/accounting-page-shell';

export const metadata = { ...metaObject('Accounting — Customers') };

export default function CustomersPage() {
  return (
    <AccountingPageShell title="Customers" subtitle="Balances & contacts">
      <CustomersView />
    </AccountingPageShell>
  );
}

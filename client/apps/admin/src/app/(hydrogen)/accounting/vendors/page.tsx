import dynamic from 'next/dynamic';
import { metaObject } from '@/config/site.config';

const VendorsView = dynamic(() =>
  import('@/app/shared/accounting/accounting-directories').then((m) => m.VendorsView)
);
import AccountingPageShell from '@/app/shared/accounting/accounting-page-shell';

export const metadata = { ...metaObject('Accounting — Vendors') };

export default function VendorsPage() {
  return (
    <AccountingPageShell title="Vendors" subtitle="Balances & contacts">
      <VendorsView />
    </AccountingPageShell>
  );
}

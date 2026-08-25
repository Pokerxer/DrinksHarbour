import dynamic from 'next/dynamic';
import { metaObject } from '@/config/site.config';

const ArApDocsView = dynamic(() => import('@/app/shared/accounting/ar-ap-docs-view'));
import AccountingPageShell from '@/app/shared/accounting/accounting-page-shell';

export const metadata = { ...metaObject('Accounting — Vendor Bills') };

export default function BillsPage() {
  return (
    <AccountingPageShell title="Vendor Bills" subtitle="Open payables · NGN">
      <ArApDocsView side="vendor" />
    </AccountingPageShell>
  );
}

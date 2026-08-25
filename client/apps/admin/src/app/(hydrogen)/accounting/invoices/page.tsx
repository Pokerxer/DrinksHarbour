import dynamic from 'next/dynamic';
import { metaObject } from '@/config/site.config';

const ArApDocsView = dynamic(() => import('@/app/shared/accounting/ar-ap-docs-view'));
import AccountingPageShell from '@/app/shared/accounting/accounting-page-shell';

export const metadata = { ...metaObject('Accounting — Invoices') };

export default function InvoicesPage() {
  return (
    <AccountingPageShell title="Customer Invoices" subtitle="Open receivables · NGN">
      <ArApDocsView side="customer" />
    </AccountingPageShell>
  );
}

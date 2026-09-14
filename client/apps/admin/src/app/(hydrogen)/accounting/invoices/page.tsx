import dynamic from 'next/dynamic';
import Link from 'next/link';
import { routes } from '@/config/routes';
import { metaObject } from '@/config/site.config';

const ArApDocsView = dynamic(
  () => import('@/app/shared/accounting/ar-ap-docs-view')
);
import AccountingPageShell from '@/app/shared/accounting/accounting-page-shell';

export const metadata = { ...metaObject('Accounting — Invoices') };

export default function InvoicesPage() {
  return (
    <AccountingPageShell
      title="Customer Invoices"
      subtitle="Open receivables · NGN"
    >
      <div className="mb-4 flex justify-end">
        <Link
          href={routes.accounting.invoiceCreate}
          className="inline-flex min-h-11 items-center rounded-xl bg-brand px-5 text-sm font-semibold text-white"
        >
          Create invoice
        </Link>
      </div>
      <ArApDocsView side="customer" />
    </AccountingPageShell>
  );
}

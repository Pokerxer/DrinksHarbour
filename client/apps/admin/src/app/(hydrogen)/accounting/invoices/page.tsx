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
      title="Customer invoices"
      subtitle="Review what customers owe and record money received."
      actions={
        <Link
          href={routes.accounting.invoiceCreate}
          className="inline-flex min-h-11 items-center rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Create invoice
        </Link>
      }
    >
      <ArApDocsView side="customer" />
    </AccountingPageShell>
  );
}

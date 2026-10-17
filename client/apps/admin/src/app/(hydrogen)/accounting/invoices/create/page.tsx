import { Suspense } from 'react';
import { metaObject } from '@/config/site.config';
import AccountingNavHeader from '@/app/shared/accounting/accounting-nav-header';
import InvoiceCreate from '@/app/shared/accounting/invoice-create';

export const metadata = { ...metaObject('Create Invoice') };
export default function InvoiceCreatePage() {
  return (
    <div className="min-h-screen min-w-0 bg-gray-50">
      <AccountingNavHeader />
      <main className="mx-auto w-full min-w-0 max-w-screen-2xl px-3 py-5 sm:px-6 sm:py-8">
        <Suspense fallback={<p>Loading invoice form…</p>}>
          <InvoiceCreate />
        </Suspense>
      </main>
    </div>
  );
}

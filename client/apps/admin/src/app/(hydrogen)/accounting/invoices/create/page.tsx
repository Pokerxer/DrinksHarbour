import { Suspense } from 'react';
import { metaObject } from '@/config/site.config';
import AccountingNavHeader from '@/app/shared/accounting/accounting-nav-header';
import InvoiceCreate from '@/app/shared/accounting/invoice-create';

export const metadata = { ...metaObject('Create Invoice') };
export default function InvoiceCreatePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <AccountingNavHeader />
      <main className="w-full px-4 py-6 xl:px-6">
        <Suspense fallback={<p>Loading invoice form…</p>}>
          <InvoiceCreate />
        </Suspense>
      </main>
    </div>
  );
}

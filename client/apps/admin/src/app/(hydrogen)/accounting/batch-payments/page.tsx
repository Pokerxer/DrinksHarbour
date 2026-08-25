import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { metaObject } from '@/config/site.config';

const BatchPaymentsView = dynamic(() => import('@/app/shared/accounting/batch-payments-view'));
import AccountingPageShell from '@/app/shared/accounting/accounting-page-shell';

export const metadata = { ...metaObject('Accounting — Batch Payments') };

export default function BatchPaymentsPage() {
  return (
    <AccountingPageShell title="Batch Payments" subtitle="Deposit & payout runs · NGN">
      <Suspense fallback={<p className="py-8 text-center text-sm text-gray-400">Loading…</p>}>
        <BatchPaymentsView />
      </Suspense>
    </AccountingPageShell>
  );
}

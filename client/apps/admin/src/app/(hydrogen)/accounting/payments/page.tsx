import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { metaObject } from '@/config/site.config';

const PaymentsView = dynamic(() => import('@/app/shared/accounting/payments-view'));
import AccountingPageShell from '@/app/shared/accounting/accounting-page-shell';

export const metadata = { ...metaObject('Accounting — Payments') };

export default function PaymentsPage() {
  return (
    <AccountingPageShell title="Payments" subtitle="Receipts & payouts · NGN">
      <Suspense fallback={<p className="py-8 text-center text-sm text-gray-400">Loading…</p>}>
        <PaymentsView />
      </Suspense>
    </AccountingPageShell>
  );
}

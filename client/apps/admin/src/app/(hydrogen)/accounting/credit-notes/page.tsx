import dynamic from 'next/dynamic';
import { metaObject } from '@/config/site.config';

const CreditNotesView = dynamic(() => import('@/app/shared/accounting/credit-notes-view'));
import AccountingPageShell from '@/app/shared/accounting/accounting-page-shell';

export const metadata = { ...metaObject('Accounting — Credit Notes') };

export default function CreditNotesPage() {
  return (
    <AccountingPageShell title="Credit Notes" subtitle="Customer credits · NGN">
      <CreditNotesView />
    </AccountingPageShell>
  );
}

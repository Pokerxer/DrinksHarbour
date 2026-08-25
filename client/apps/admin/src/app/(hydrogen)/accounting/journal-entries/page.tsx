import dynamic from 'next/dynamic';
import { metaObject } from '@/config/site.config';

const AccountingJournalEntries = dynamic(
  () => import('@/app/shared/accounting/accounting-journal-entries')
);

export const metadata = { ...metaObject('Accounting — Journal Entries') };

export default function JournalEntriesPage() {
  return <AccountingJournalEntries />;
}

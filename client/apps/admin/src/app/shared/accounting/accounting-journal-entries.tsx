'use client';

import AccountingPageShell from './accounting-page-shell';
import JournalEntriesBrowser from './journal-entries-browser';

/** /accounting/journal-entries — module chrome + control-bar browser. */
export default function AccountingJournalEntries() {
  return (
    <AccountingPageShell
      title="Journal entries"
      subtitle="Trace operational activity and review balanced postings across your business."
    >
      <JournalEntriesBrowser />
    </AccountingPageShell>
  );
}

'use client';

import AccountingNavHeader from './accounting-nav-header';
import JournalEntriesBrowser from './journal-entries-browser';

/** /accounting/journal-entries — module chrome + control-bar browser. */
export default function AccountingJournalEntries() {
  return (
    <div className="min-h-screen bg-gray-50">
      <AccountingNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <JournalEntriesBrowser />
      </main>
    </div>
  );
}

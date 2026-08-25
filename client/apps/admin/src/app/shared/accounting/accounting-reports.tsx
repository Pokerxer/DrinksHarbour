'use client';

import AccountingNavHeader from './accounting-nav-header';
import ReportsView from './reports-view';

/** /accounting/reports — module chrome + tabbed report workspace. */
export default function AccountingReports() {
  return (
    <div className="min-h-screen bg-gray-50">
      <AccountingNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <ReportsView />
      </main>
    </div>
  );
}

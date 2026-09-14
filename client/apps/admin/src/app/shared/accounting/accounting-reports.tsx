'use client';

import AccountingPageShell from './accounting-page-shell';
import ReportsView from './reports-view';

/** /accounting/reports — module chrome + tabbed report workspace. */
export default function AccountingReports() {
  return (
    <AccountingPageShell
      title="Financial reports"
      subtitle="Review your trial balance, income, financial position and account movements."
    >
      <ReportsView />
    </AccountingPageShell>
  );
}

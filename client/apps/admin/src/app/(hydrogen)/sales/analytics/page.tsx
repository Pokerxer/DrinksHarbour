// client/apps/admin/src/app/(hydrogen)/sales/analytics/page.tsx
// Reporting → Sales. The Odoo-style analysis for the whole sales ledger.
'use client';

import { Suspense } from 'react';
import SalesNavHeader from '@/app/shared/sales/sales-nav-header';
import SalesAnalytics from '@/app/shared/sales/sales-analytics/sales-analytics';

export default function SalesAnalyticsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SalesNavHeader />
      <main className="mx-auto max-w-[1400px] px-4 py-6">
        <Suspense>
          <SalesAnalytics />
        </Suspense>
      </main>
    </div>
  );
}

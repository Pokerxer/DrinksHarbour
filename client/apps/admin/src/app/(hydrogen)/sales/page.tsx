// client/apps/admin/src/app/(hydrogen)/sales/page.tsx
//
// The Sales module home. The sidebar menu labels this route "Overview", but
// the page used to be a blank client-side redirect to /sales/orders — a flash
// of nothing, then the wrong destination for anyone who meant to land here.
// It now renders a real overview: server-aggregated KPIs, shortcuts and a
// recent-documents feed (see shared/sales/sales-overview).
'use client';

import { Suspense } from 'react';
import SalesNavHeader from '@/app/shared/sales/sales-nav-header';
import SalesOverview from '@/app/shared/sales/sales-overview/sales-overview';

export default function SalesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SalesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Suspense>
          <SalesOverview />
        </Suspense>
      </main>
    </div>
  );
}

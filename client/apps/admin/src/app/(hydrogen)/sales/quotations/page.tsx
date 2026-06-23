// client/apps/isomorphic/src/app/(hydrogen)/sales/quotations/page.tsx
'use client';

import { Suspense } from 'react';
import SalesNavHeader from '@/app/shared/sales/sales-nav-header';
import SalesQuotations from '@/app/shared/sales/sales-quotations';

export default function SalesQuotationsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SalesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Suspense>
          <SalesQuotations />
        </Suspense>
      </main>
    </div>
  );
}

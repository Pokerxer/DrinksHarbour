// client/apps/admin/src/app/(hydrogen)/sales/orders/page.tsx
'use client';

import { Suspense } from 'react';
import SalesNavHeader from '@/app/shared/sales/sales-nav-header';
import SalesOrders from '@/app/shared/sales/sales-orders';

export default function SalesOrdersPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SalesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Suspense>
          <SalesOrders />
        </Suspense>
      </main>
    </div>
  );
}

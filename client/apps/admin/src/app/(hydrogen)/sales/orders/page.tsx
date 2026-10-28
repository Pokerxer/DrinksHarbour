// client/apps/admin/src/app/(hydrogen)/sales/orders/page.tsx
'use client';

import { Suspense } from 'react';
import SalesNavHeader from '@/app/shared/sales/sales-nav-header';
import SalesOrders from '@/app/shared/sales/sales-orders';
import SalesOrdersOnlinePanel from '@/app/shared/sales/sales-orders-online-panel';

export default function SalesOrdersPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SalesNavHeader />
      <main className="w-full min-w-0 px-2 py-2">
        <Suspense>
          {/* Marketplace orders containing this tenant's lines — the tenant
              fulfils their slice here; the ERM list below stays quotations
              and till paperwork. The server scopes both to the tenant. */}
          <SalesOrdersOnlinePanel />
          <SalesOrders />
        </Suspense>
      </main>
    </div>
  );
}

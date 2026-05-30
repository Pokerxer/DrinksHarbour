'use client';

import { Suspense } from 'react';
import PurchasesNavHeader from '@/app/shared/purchases/purchases-nav-header';
import PurchasesOrders from '@/app/shared/purchases/purchases-orders';

export default function PurchasesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PurchasesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Suspense>
          <PurchasesOrders />
        </Suspense>
      </main>
    </div>
  );
}

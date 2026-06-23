'use client';

import { Suspense } from 'react';
import PurchasesNavHeader from '@/app/shared/purchases/purchases-nav-header';
import StockTransfersList from '@/app/shared/purchases/stock-transfers-list';

export default function StockTransfersPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PurchasesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Suspense>
          <StockTransfersList />
        </Suspense>
      </main>
    </div>
  );
}

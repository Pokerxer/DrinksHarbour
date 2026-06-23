'use client';

import { Suspense } from 'react';
import PurchasesNavHeader from '@/app/shared/purchases/purchases-nav-header';
import StockTransferCreate from '@/app/shared/purchases/stock-transfer-create';

export default function CreateStockTransferPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PurchasesNavHeader />
      <main className="mx-auto max-w-4xl px-4 py-6">
        <Suspense>
          <StockTransferCreate />
        </Suspense>
      </main>
    </div>
  );
}

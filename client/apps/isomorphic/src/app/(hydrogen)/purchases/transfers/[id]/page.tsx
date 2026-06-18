'use client';

import { Suspense } from 'react';
import { use } from 'react';
import PurchasesNavHeader from '@/app/shared/purchases/purchases-nav-header';
import StockTransferDetail from '@/app/shared/purchases/stock-transfer-detail';

export default function StockTransferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <div className="min-h-screen bg-gray-50">
      <PurchasesNavHeader />
      <main className="mx-auto max-w-4xl px-4 py-6">
        <Suspense>
          <StockTransferDetail id={id} />
        </Suspense>
      </main>
    </div>
  );
}

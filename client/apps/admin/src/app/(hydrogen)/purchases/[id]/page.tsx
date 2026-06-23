'use client';
import { use } from 'react';
import PurchasesNavHeader from '@/app/shared/purchases/purchases-nav-header';
import PurchasesPODetail from '@/app/shared/purchases/purchases-po-detail';
export default function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <div className="min-h-screen bg-gray-50">
      <PurchasesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <PurchasesPODetail id={id} />
      </main>
    </div>
  );
}

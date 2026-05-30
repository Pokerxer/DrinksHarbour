'use client';
import PurchasesNavHeader from '@/app/shared/purchases/purchases-nav-header';
import PurchasesPODetail from '@/app/shared/purchases/purchases-po-detail';
export default function PurchaseDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <PurchasesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6"><PurchasesPODetail id={params.id} /></main>
    </div>
  );
}

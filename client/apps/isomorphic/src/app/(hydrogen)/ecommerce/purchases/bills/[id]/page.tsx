'use client';
import PurchasesNavHeader from '@/app/shared/purchases/purchases-nav-header';
import PurchasesBillDetail from '@/app/shared/purchases/purchases-bill-detail';
export default function BillDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <PurchasesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6"><PurchasesBillDetail id={params.id} /></main>
    </div>
  );
}

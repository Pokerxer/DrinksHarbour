'use client';
import PurchasesNavHeader from '@/app/shared/purchases/purchases-nav-header';
import PurchasesReceiptDetail from '@/app/shared/purchases/purchases-receipt-detail';
export default function ReceiptDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <PurchasesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6"><PurchasesReceiptDetail id={params.id} /></main>
    </div>
  );
}

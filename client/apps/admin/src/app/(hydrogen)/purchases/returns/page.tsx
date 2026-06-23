'use client';
import PurchasesNavHeader from '@/app/shared/purchases/purchases-nav-header';
import PurchasesReturns from '@/app/shared/purchases/purchases-returns';
export default function VendorReturnsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PurchasesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6"><PurchasesReturns /></main>
    </div>
  );
}

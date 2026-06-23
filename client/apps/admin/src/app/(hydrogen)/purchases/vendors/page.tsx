'use client';
import PurchasesNavHeader from '@/app/shared/purchases/purchases-nav-header';
import PurchasesVendors from '@/app/shared/purchases/purchases-vendors';
export default function PurchaseVendorsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PurchasesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6"><PurchasesVendors /></main>
    </div>
  );
}

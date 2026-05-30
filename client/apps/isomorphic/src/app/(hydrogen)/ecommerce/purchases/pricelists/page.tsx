'use client';
import PurchasesNavHeader from '@/app/shared/purchases/purchases-nav-header';
import PurchasesPricelists from '@/app/shared/purchases/purchases-pricelists';
export default function VendorPricelistsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PurchasesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6"><PurchasesPricelists /></main>
    </div>
  );
}

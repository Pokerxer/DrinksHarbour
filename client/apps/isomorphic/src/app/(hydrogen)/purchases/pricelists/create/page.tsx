'use client';
import PurchasesNavHeader from '@/app/shared/purchases/purchases-nav-header';
import PurchasesPricelistCreate from '@/app/shared/purchases/purchases-pricelist-create';
export default function CreatePricelistPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PurchasesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6"><PurchasesPricelistCreate /></main>
    </div>
  );
}

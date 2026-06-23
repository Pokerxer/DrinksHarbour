'use client';
import PurchasesNavHeader from '@/app/shared/purchases/purchases-nav-header';
import PurchasesAgreements from '@/app/shared/purchases/purchases-agreements';
export default function PurchaseAgreementsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PurchasesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6"><PurchasesAgreements /></main>
    </div>
  );
}

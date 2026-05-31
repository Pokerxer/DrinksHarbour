'use client';
import PurchasesNavHeader from '@/app/shared/purchases/purchases-nav-header';
import PurchasesAgreementCreate from '@/app/shared/purchases/purchases-agreement-create';
export default function CreateAgreementPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PurchasesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6"><PurchasesAgreementCreate /></main>
    </div>
  );
}

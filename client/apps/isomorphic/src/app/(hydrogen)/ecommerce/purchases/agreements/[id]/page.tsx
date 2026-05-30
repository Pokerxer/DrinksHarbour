'use client';
import PurchasesNavHeader from '@/app/shared/purchases/purchases-nav-header';
import PurchasesAgreementDetail from '@/app/shared/purchases/purchases-agreement-detail';
export default function AgreementDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <PurchasesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6"><PurchasesAgreementDetail id={params.id} /></main>
    </div>
  );
}

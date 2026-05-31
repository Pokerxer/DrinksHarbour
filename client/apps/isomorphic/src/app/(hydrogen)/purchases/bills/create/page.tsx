'use client';
import { Suspense } from 'react';
import PurchasesNavHeader from '@/app/shared/purchases/purchases-nav-header';
import PurchasesBillCreate from '@/app/shared/purchases/purchases-bill-create';
export default function CreateBillPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PurchasesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6"><Suspense><PurchasesBillCreate /></Suspense></main>
    </div>
  );
}

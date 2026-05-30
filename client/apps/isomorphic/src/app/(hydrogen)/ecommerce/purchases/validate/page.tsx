'use client';
import { Suspense } from 'react';
import PurchasesNavHeader from '@/app/shared/purchases/purchases-nav-header';
import PurchasesReceive from '@/app/shared/purchases/purchases-receive';
export default function ValidateReceiptPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PurchasesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6"><Suspense><PurchasesReceive /></Suspense></main>
    </div>
  );
}

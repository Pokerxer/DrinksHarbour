'use client';
import PurchasesNavHeader from '@/app/shared/purchases/purchases-nav-header';
import PurchasesSettings from '@/app/shared/purchases/purchases-settings';
export default function PurchaseSettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PurchasesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6"><PurchasesSettings /></main>
    </div>
  );
}

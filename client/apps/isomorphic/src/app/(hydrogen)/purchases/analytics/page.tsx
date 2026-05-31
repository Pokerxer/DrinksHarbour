'use client';
import PurchasesNavHeader from '@/app/shared/purchases/purchases-nav-header';
import PurchasesAnalytics from '@/app/shared/purchases/purchases-analytics';
export default function PurchaseAnalyticsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PurchasesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6"><PurchasesAnalytics /></main>
    </div>
  );
}

'use client';
import PurchasesNavHeader from '@/app/shared/purchases/purchases-nav-header';
import PurchasesExchangeRates from '@/app/shared/purchases/purchases-exchange-rates';
export default function ExchangeRatesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PurchasesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6"><PurchasesExchangeRates /></main>
    </div>
  );
}

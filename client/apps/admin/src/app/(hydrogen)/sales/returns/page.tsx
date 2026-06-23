'use client';

import SalesNavHeader from '@/app/shared/sales/sales-nav-header';
import SalesReturns from '@/app/shared/sales/sales-returns';

export default function SalesReturnsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SalesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <SalesReturns />
      </main>
    </div>
  );
}

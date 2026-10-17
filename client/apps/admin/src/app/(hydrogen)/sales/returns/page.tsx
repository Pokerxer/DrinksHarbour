'use client';

import SalesNavHeader from '@/app/shared/sales/sales-nav-header';
import SalesReturns from '@/app/shared/sales/sales-returns';

export default function SalesReturnsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SalesNavHeader />
      <main className="w-full min-w-0 px-2 py-2">
        <SalesReturns />
      </main>
    </div>
  );
}

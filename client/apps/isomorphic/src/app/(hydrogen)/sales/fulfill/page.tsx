'use client';

import SalesNavHeader from '@/app/shared/sales/sales-nav-header';
import SalesFulfill from '@/app/shared/sales/sales-fulfill';

export default function SalesFulfillPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SalesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <SalesFulfill />
      </main>
    </div>
  );
}

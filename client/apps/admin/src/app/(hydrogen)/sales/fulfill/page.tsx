'use client';

import SalesNavHeader from '@/app/shared/sales/sales-nav-header';
import SalesFulfill from '@/app/shared/sales/sales-fulfill';

export default function SalesFulfillPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SalesNavHeader />
      <main className="w-full min-w-0 px-2 py-2">
        <SalesFulfill />
      </main>
    </div>
  );
}

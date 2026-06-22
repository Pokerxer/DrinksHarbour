'use client';

import { use } from 'react';
import SalesNavHeader from '@/app/shared/sales/sales-nav-header';
import SalesFulfillDetail from '@/app/shared/sales/sales-fulfill-detail';

export default function SalesFulfillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div className="min-h-screen bg-gray-50">
      <SalesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <SalesFulfillDetail id={id} />
      </main>
    </div>
  );
}

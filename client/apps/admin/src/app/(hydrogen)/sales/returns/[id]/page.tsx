'use client';

import { use } from 'react';
import SalesNavHeader from '@/app/shared/sales/sales-nav-header';
import SalesReturnDetail from '@/app/shared/sales/sales-return-detail';

export default function SalesReturnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <div className="min-h-screen bg-gray-50">
      <SalesNavHeader />
      <main className="mx-auto max-w-7xl px-3 py-3">
        <SalesReturnDetail id={id} />
      </main>
    </div>
  );
}

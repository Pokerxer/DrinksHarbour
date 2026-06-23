'use client';

import { use } from 'react';
import SalesNavHeader from '@/app/shared/sales/sales-nav-header';
import SalesDetail from '@/app/shared/sales/sales-detail';

export default function SalesDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <div className="min-h-screen bg-gray-50">
      <SalesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <SalesDetail id={id} />
      </main>
    </div>
  );
}

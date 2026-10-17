'use client';

import { Suspense } from 'react';
import SalesNavHeader from '@/app/shared/sales/sales-nav-header';
import SalesReturnCreate from '@/app/shared/sales/sales-return-create';

export default function SalesReturnCreatePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SalesNavHeader />
      <main className="mx-auto max-w-7xl px-3 py-3">
        <Suspense>
          <SalesReturnCreate />
        </Suspense>
      </main>
    </div>
  );
}

// client/apps/admin/src/app/(hydrogen)/sales/create/page.tsx
'use client';

import SalesNavHeader from '@/app/shared/sales/sales-nav-header';
import SalesCreate from '@/app/shared/sales/sales-create';

export default function SalesCreatePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SalesNavHeader />
      <main className="w-full px-4 py-6 xl:px-6">
        <SalesCreate />
      </main>
    </div>
  );
}

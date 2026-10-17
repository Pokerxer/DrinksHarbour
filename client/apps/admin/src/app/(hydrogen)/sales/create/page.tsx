// client/apps/admin/src/app/(hydrogen)/sales/create/page.tsx
'use client';

import SalesNavHeader from '@/app/shared/sales/sales-nav-header';
import SalesDraftWorkspace from '@/app/shared/sales/sales-draft-workspace';

export default function SalesCreatePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SalesNavHeader />
      <main className="w-full px-3 py-3 xl:px-4">
        <SalesDraftWorkspace />
      </main>
    </div>
  );
}

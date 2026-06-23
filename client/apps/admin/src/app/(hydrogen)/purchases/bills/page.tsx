import { Suspense } from 'react';
import PurchasesNavHeader from '@/app/shared/purchases/purchases-nav-header';
import PurchasesBills from '@/app/shared/purchases/purchases-bills';
export default function VendorBillsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PurchasesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Suspense>
          <PurchasesBills />
        </Suspense>
      </main>
    </div>
  );
}

import { Suspense } from 'react';
import { metaObject } from '@/config/site.config';
import StockTransfersList from '@/app/shared/purchases/stock-transfers-list';

export const metadata = { ...metaObject('Inventory - Transfers') };

export default function InventoryTransfersPage() {
  return (
    <main className="p-4 md:p-5 lg:p-6">
      <Suspense>
        <StockTransfersList />
      </Suspense>
    </main>
  );
}

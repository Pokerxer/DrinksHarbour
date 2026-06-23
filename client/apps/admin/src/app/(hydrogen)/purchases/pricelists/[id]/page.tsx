'use client';
import { use } from 'react';
import PurchasesNavHeader from '@/app/shared/purchases/purchases-nav-header';
import PurchasesPricelistDetail from '@/app/shared/purchases/purchases-pricelist-detail';
export default function VendorPricelistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <div className="min-h-screen bg-[#FAF8F3] bg-[radial-gradient(ellipse_1100px_500px_at_50%_-10%,rgba(178,2,2,0.06),transparent)]">
      <PurchasesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <PurchasesPricelistDetail id={id} />
      </main>
    </div>
  );
}

'use client';
import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import ProductInventoryPage from '@/app/shared/warehouses/product-inventory-page';

export default function WarehouseProductPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <Suspense fallback={null}>
      <ProductInventoryPage subProductId={id} />
    </Suspense>
  );
}

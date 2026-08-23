'use client';
import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import WarehouseDetail from '@/app/shared/warehouses/warehouse-detail';

export default function WarehouseDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <Suspense fallback={null}>
      <WarehouseDetail warehouseId={id} />
    </Suspense>
  );
}

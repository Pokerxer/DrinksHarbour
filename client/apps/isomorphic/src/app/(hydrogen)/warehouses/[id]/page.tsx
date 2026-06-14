'use client';
import { useParams } from 'next/navigation';
import WarehouseDetail from '@/app/shared/warehouses/warehouse-detail';

export default function WarehouseDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="min-h-screen bg-[#FAF8F3]">
      <main className="mx-auto max-w-7xl px-4 py-6">
        <WarehouseDetail warehouseId={id} />
      </main>
    </div>
  );
}

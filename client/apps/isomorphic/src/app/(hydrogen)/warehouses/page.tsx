'use client';
import WarehousesList from '@/app/shared/warehouses/warehouses-list';

export default function WarehousesPage() {
  return (
    <div className="min-h-screen bg-[#FAF8F3]">
      <main className="mx-auto max-w-7xl px-4 py-6">
        <WarehousesList />
      </main>
    </div>
  );
}

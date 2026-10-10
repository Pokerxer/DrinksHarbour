'use client';
import { useParams } from 'next/navigation';
import LocationAnalysis from '@/app/shared/warehouses/warehouse-location-analysis';

export default function WarehouseLocationAnalysisPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <LocationAnalysis key={id} warehouseId={id} />
    </main>
  );
}

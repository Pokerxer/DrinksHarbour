'use client';
import { use } from 'react';
import PurchasesVendorTasks from '@/app/shared/purchases/purchases-vendor-tasks';

export default function VendorTasksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <PurchasesVendorTasks vendorId={id} />;
}

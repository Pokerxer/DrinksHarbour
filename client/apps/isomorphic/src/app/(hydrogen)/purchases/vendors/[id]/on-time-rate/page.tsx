'use client';
import { use } from 'react';
import PurchasesVendorOnTime from '@/app/shared/purchases/purchases-vendor-ontime';

export default function VendorOnTimePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <PurchasesVendorOnTime vendorId={id} />;
}

'use client';
import { use } from 'react';
import PurchasesVendorOutstanding from '@/app/shared/purchases/purchases-vendor-outstanding';

export default function VendorOutstandingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <PurchasesVendorOutstanding vendorId={id} />;
}

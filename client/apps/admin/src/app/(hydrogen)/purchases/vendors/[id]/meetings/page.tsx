'use client';
import { use } from 'react';
import PurchasesVendorMeetings from '@/app/shared/purchases/purchases-vendor-meetings';

export default function VendorMeetingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <PurchasesVendorMeetings vendorId={id} />;
}

'use client';
import { use } from 'react';
import PurchasesInvoiced from '@/app/shared/purchases/purchases-invoiced';

export default function VendorInvoicedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <PurchasesInvoiced vendorId={id} />;
}

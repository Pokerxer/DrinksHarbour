'use client';

import { use } from 'react';
import SalesNavHeader from '@/app/shared/sales/sales-nav-header';
import SalesDetail from '@/app/shared/sales/sales-detail';

export default function SalesDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <>
      <SalesNavHeader />
      <SalesDetail id={id} />
    </>
  );
}

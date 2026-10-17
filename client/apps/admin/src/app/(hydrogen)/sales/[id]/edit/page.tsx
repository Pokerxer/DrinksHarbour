'use client';

import { use } from 'react';
import SalesEdit from '@/app/shared/sales/sales-edit';

export default function SalesEditPage({params}: {params: Promise<{id: string}>}) {
  const {id} = use(params);
  return <SalesEdit id={id} />;
}

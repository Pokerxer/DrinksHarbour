// client/apps/isomorphic/src/app/(hydrogen)/sales/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { routes } from '@/config/routes';

export default function SalesPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(routes.eCommerce.salesOrders);
  }, [router]);
  return null;
}

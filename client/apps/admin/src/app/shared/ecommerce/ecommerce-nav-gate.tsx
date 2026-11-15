'use client';

import { usePathname } from 'next/navigation';
import EcommerceNavHeader from '@/app/shared/ecommerce/ecommerce-nav-header';
import { routes } from '@/config/routes';

export default function EcommerceNavGate() {
  const pathname = usePathname();
  const whatsAppOrders = routes.whatsappOrders.list;

  // The dashboard and WhatsApp order layouts provide their own navigation.
  if (
    pathname === routes.eCommerce.dashboard ||
    pathname === whatsAppOrders ||
    pathname?.startsWith(`${whatsAppOrders}/`)
  )
    return null;

  return <EcommerceNavHeader />;
}

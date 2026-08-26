// @ts-nocheck
'use client';

/**
 * Renders EcommerceNavHeader on every /ecommerce route EXCEPT the dashboard,
 * which already renders its own header. Keeps one source of truth for the
 * chrome without double-stacking it on the landing page.
 */

import { usePathname } from 'next/navigation';
import EcommerceNavHeader from '@/app/shared/ecommerce/ecommerce-nav-header';

export default function EcommerceNavGate() {
  const pathname = usePathname();
  if (pathname === '/ecommerce') return null;
  return <EcommerceNavHeader />;
}

import { Suspense } from 'react';
import EcommerceDashboard from '@/app/shared/ecommerce/dashboard';
import DashboardSkeleton from '@/app/shared/ecommerce/dashboard/dashboard-skeleton';
import { metaObject } from '@/config/site.config';
import type { DashboardParams } from '@/services/dashboard.service';

export const metadata = {
  ...metaObject('E-Commerce'),
};

/**
 * The dashboard fetches auth + analytics server-side; wrapping it in a single
 * Suspense boundary lets the shell stream in behind a layout-matched skeleton
 * instead of blocking navigation on two sequential network calls.
 */
export default async function eCommerceDashboardPage({
  searchParams,
}: {
  searchParams: Promise<DashboardParams>;
}) {
  const params = await searchParams;
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <EcommerceDashboard
        period={params.period}
        from={params.from}
        to={params.to}
      />
    </Suspense>
  );
}

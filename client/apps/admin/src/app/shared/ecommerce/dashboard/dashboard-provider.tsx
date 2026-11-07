'use client';

import { useState, useMemo } from 'react';
import { DashboardContext } from './use-dashboard';
import type { DashboardData } from '@/services/dashboard.service';

/**
 * Data-flow contract: ALL dashboard data is fetched server-side (one
 * `getDashboardData` call per request in index.tsx) and handed to this
 * provider as a prop. There are deliberately no client-side fetches here —
 * period switches run through `useTransition` + `router.push`, so React keeps
 * the previous payload rendered (stale-while-revalidate feel) and no request
 * can race or leak past an unmount. Redundant-fetch review (2026-10): single
 * call per render, sequential only because auth token → analytics call.
 */

export default function DashboardProvider({
  data,
  children,
}: {
  data: DashboardData | null;
  children: React.ReactNode;
}) {
  const [isRefreshing, setRefreshing] = useState(false);

  const value = useMemo(
    () => ({ data, meta: data?.meta ?? null, isRefreshing, setRefreshing }),
    [data, isRefreshing]
  );

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

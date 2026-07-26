'use client';

import { useState, useMemo } from 'react';
import { DashboardContext } from './use-dashboard';
import type { DashboardData } from '@/services/dashboard.service';

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

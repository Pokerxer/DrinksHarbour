'use client';

import { DashboardContext } from './use-dashboard';
import type { DashboardData } from '@/services/dashboard.service';

export default function DashboardProvider({
  data,
  children,
}: {
  data: DashboardData;
  children: React.ReactNode;
}) {
  return (
    <DashboardContext.Provider value={data}>
      {children}
    </DashboardContext.Provider>
  );
}

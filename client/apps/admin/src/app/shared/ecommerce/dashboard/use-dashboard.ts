'use client';

import { createContext, useContext } from 'react';
import type { DashboardData, PeriodMeta } from '@/services/dashboard.service';

export interface DashboardContextValue {
  data: DashboardData | null;
  meta: PeriodMeta | null;
  isRefreshing: boolean;
  setRefreshing: (v: boolean) => void;
}

export const DashboardContext = createContext<DashboardContextValue>({
  data: null,
  meta: null,
  isRefreshing: false,
  setRefreshing: () => {},
});

/** Unchanged signature — existing widgets consume this as-is. */
export function useDashboard(): DashboardData | null {
  return useContext(DashboardContext).data;
}

/** Period labels, for widgets that display which window they are showing. */
export function useDashboardMeta(): PeriodMeta | null {
  return useContext(DashboardContext).meta;
}

/** Used by the period switcher to flag an in-flight transition, and by
 *  DashboardBody to dim the widgets while one is pending. */
export function useDashboardRefreshControl() {
  const { isRefreshing, setRefreshing } = useContext(DashboardContext);
  return { isRefreshing, setRefreshing };
}

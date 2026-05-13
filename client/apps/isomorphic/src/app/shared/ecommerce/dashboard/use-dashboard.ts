'use client';

import { createContext, useContext } from 'react';
import type { DashboardData } from '@/services/dashboard.service';

export const DashboardContext = createContext<DashboardData | null>(null);

export function useDashboard(): DashboardData | null {
  return useContext(DashboardContext);
}

'use client';

import { createContext, useContext } from 'react';
import type { WebAnalyticsData } from '@/services/webAnalytics.service';

interface WebAnalyticsContextValue {
  data: WebAnalyticsData | null;
}

const WebAnalyticsContext = createContext<WebAnalyticsContextValue>({ data: null });

export function useWebAnalytics(): WebAnalyticsContextValue {
  return useContext(WebAnalyticsContext);
}

export default function WebAnalyticsProvider({
  data,
  children,
}: {
  data: WebAnalyticsData | null;
  children: React.ReactNode;
}) {
  return (
    <WebAnalyticsContext.Provider value={{ data }}>
      {children}
    </WebAnalyticsContext.Provider>
  );
}

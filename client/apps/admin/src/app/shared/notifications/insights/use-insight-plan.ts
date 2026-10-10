'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  planningRequest,
  type PlanningEndpoint,
  type InsightPlan,
} from '@/services/notificationInsights.service';
export function useInsightPlan(endpoint: PlanningEndpoint, query: string) {
  const { data: session, status } = useSession();
  const token = status === 'authenticated' ? session?.user?.token || '' : '';
  const scope = `${session?.user?.id}:${session?.user?.tenantId}:${token}:${endpoint}:${query}`;
  const current = useRef(scope);
  current.current = scope;
  const request = useRef<AbortController | null>(null),
    serial = useRef(0);
  const [state, setState] = useState<{
    scope: string;
    data: InsightPlan | null;
    loading: boolean;
    error: string;
  }>({ scope, data: null, loading: true, error: '' });
  const load = useCallback(
    async (refresh = false) => {
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      const sequence = ++serial.current;
      if (!token) {
        setState({
          scope,
          data: null,
          loading: status === 'loading',
          error: status === 'loading' ? '' : 'Sign in to view recommendations.',
        });
        return;
      }
      setState((s) => ({
        scope,
        data: s.scope === scope ? s.data : null,
        loading: true,
        error: '',
      }));
      try {
        const data = await planningRequest(
          token,
          endpoint,
          query,
          controller.signal,
          refresh
        );
        if (
          current.current === scope &&
          serial.current === sequence &&
          !controller.signal.aborted
        )
          setState({ scope, data, loading: false, error: '' });
      } catch (error) {
        if (
          current.current === scope &&
          serial.current === sequence &&
          !controller.signal.aborted
        )
          setState({
            scope,
            data: null,
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : 'Unable to load recommendations.',
          });
      }
    },
    [scope, token, status, endpoint, query]
  );
  useEffect(() => {
    void load();
    return () => {
      request.current?.abort();
    };
  }, [load]);
  return {
    data: state.scope === scope ? state.data : null,
    loading: status === 'loading' || state.scope !== scope || state.loading,
    error: state.scope === scope ? state.error : '',
    scope,
    refresh: () => void load(true),
  };
}

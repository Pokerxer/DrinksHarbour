'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  promotionSuggestionsRequest,
  type PromotionSuggestionPlan,
} from '@/services/promotionSuggestions.service';
export function usePromotionSuggestions(query: string) {
  const { data: session, status } = useSession();
  const token = status === 'authenticated' ? session?.user?.token || '' : '';
  const scope = `${session?.user?.id}:${session?.user?.tenantId}:${token}:${query}`;
  const current = useRef(scope);
  current.current = scope;
  const abort = useRef<AbortController | null>(null);
  const [state, setState] = useState<{
    scope: string;
    data: PromotionSuggestionPlan | null;
    loading: boolean;
    error: string;
  }>({ scope, data: null, loading: true, error: '' });
  const refresh = useCallback(async () => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    if (!token) {
      setState({
        scope,
        data: null,
        loading: false,
        error:
          status === 'loading' ? '' : 'Sign in to view promotion suggestions.',
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
      const data = await promotionSuggestionsRequest(
        token,
        query,
        controller.signal
      );
      if (!controller.signal.aborted && current.current === scope)
        setState({ scope, data, loading: false, error: '' });
    } catch (e) {
      if (!controller.signal.aborted && current.current === scope)
        setState((s) => ({
          ...s,
          loading: false,
          error: e instanceof Error ? e.message : 'Unable to load suggestions.',
        }));
    }
  }, [scope, token, query, status]);
  useEffect(() => {
    void refresh();
    return () => abort.current?.abort();
  }, [refresh]);
  return {
    data: state.scope === scope ? state.data : null,
    loading: status === 'loading' || state.scope !== scope || state.loading,
    error: state.scope === scope ? state.error : '',
    scope,
    refresh,
  };
}

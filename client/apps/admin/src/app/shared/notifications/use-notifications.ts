'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  notificationRequest,
  type NotificationCategory,
  type NotificationPage,
} from '@/services/notification.service';
const CHANGED = 'drinksharbour:notifications-changed';
const empty = (page: number, limit: number): NotificationPage => ({
  notifications: [],
  total: 0,
  unreadCount: 0,
  page,
  limit,
});
export function useNotifications(
  options: {
    category?: NotificationCategory;
    type?: 'product_approved' | 'product_rejected';
    search?: string;
    sort?: 'newest' | 'oldest';
    startDate?: string;
    endDate?: string;
    unreadOnly?: boolean;
    page?: number;
    limit?: number;
  } = {}
) {
  const { data: session, status } = useSession();
  const token = status === 'authenticated' ? session?.user?.token || '' : '';
  const {
    category = 'all',
    type,
    search = '',
    sort = 'newest',
    startDate = '',
    endDate = '',
    unreadOnly = false,
    page = 1,
    limit = 20,
  } = options;
  const sessionKey = `${session?.user?.id || ''}:${session?.user?.tenantId || ''}`;
  const identity = `${sessionKey}:${token}`;
  const scope = `${identity}:${category}:${type || ''}:${unreadOnly}:${page}:${limit}:${search}:${sort}:${startDate}:${endDate}`;
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const request = useRef<AbortController | null>(null),
    serial = useRef(0),
    mounted = useRef(true);
  const [state, setState] = useState<{
    scope: string;
    data: NotificationPage;
    loading: boolean;
    error: string;
  }>({ scope, data: empty(page, limit), loading: true, error: '' });
  const [mutation, setMutation] = useState<string | null>(null);
  const data = state.scope === scope ? state.data : empty(page, limit);
  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const sequence = ++serial.current;
    if (!token) {
      setState({
        scope,
        data: empty(page, limit),
        loading: false,
        error: status === 'loading' ? '' : 'Sign in to view notifications.',
      });
      return;
    }
    setState((s) => ({
      scope,
      data: s.scope === scope ? s.data : empty(page, limit),
      loading: true,
      error: '',
    }));
    try {
      const query = new URLSearchParams({
        category,
        ...(type ? { type } : {}),
        ...(startDate ? { startDate, endDate } : {}),
        ...(search ? { search } : {}),
        ...(sort !== 'newest' ? { sort } : {}),
        unreadOnly: String(unreadOnly),
        page: String(page),
        limit: String(limit),
      });
      const result = await notificationRequest(token, `?${query}`, {
        signal: controller.signal,
      });
      if (
        mounted.current &&
        currentScope.current === scope &&
        serial.current === sequence
      )
        setState({ scope, data: result, loading: false, error: '' });
    } catch (e) {
      if (
        controller.signal.aborted ||
        !mounted.current ||
        currentScope.current !== scope ||
        serial.current !== sequence
      )
        return;
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : 'Unable to load notifications.',
      }));
    }
  }, [
    scope,
    token,
    status,
    category,
    type,
    unreadOnly,
    page,
    limit,
    search,
    sort,
    startDate,
    endDate,
  ]);
  useEffect(() => {
    mounted.current = true;
    void load();
    const visible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    const changed = (event: Event) => {
      if ((event as CustomEvent<string>).detail === sessionKey) void load();
    };
    const timer = token ? window.setInterval(visible, 60_000) : undefined;
    document.addEventListener('visibilitychange', visible);
    window.addEventListener(CHANGED, changed);
    return () => {
      mounted.current = false;
      request.current?.abort();
      if (timer) window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener(CHANGED, changed);
    };
  }, [load, token, identity, sessionKey]);
  const mark = async (path: string) => {
    if (!token || mutation === identity) return;
    setMutation(identity);
    try {
      await notificationRequest(token, path, { method: 'PATCH' });
      if (mounted.current && currentIdentity.current === identity)
        window.dispatchEvent(new CustomEvent(CHANGED, { detail: sessionKey }));
    } catch (e) {
      if (mounted.current && currentIdentity.current === identity)
        setState((s) => ({
          ...s,
          error:
            e instanceof Error
              ? e.message
              : 'Unable to mark notifications read.',
        }));
    } finally {
      if (mounted.current && currentIdentity.current === identity)
        setMutation(null);
    }
  };
  return {
    scope,
    data,
    loading: status === 'loading' || state.scope !== scope || state.loading,
    error: state.scope === scope ? state.error : '',
    busy: mutation === identity,
    refresh: load,
    markRead: (id: string) => mark(`/${encodeURIComponent(id)}/read`),
    markAllRead: () =>
      mark(
        '/read-all' +
          (startDate ? `?${new URLSearchParams({ startDate, endDate })}` : '')
      ),
  };
}

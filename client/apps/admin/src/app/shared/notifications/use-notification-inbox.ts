'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  notificationRequest,
  type NotificationPage,
} from '@/services/notification.service';
const CHANGED = 'drinksharbour:notifications-changed';
const empty = (): NotificationPage => ({
  notifications: [],
  total: 0,
  unreadCount: 0,
  page: 1,
  limit: 50,
});
const message = (e: unknown) =>
  e instanceof Error ? e.message : 'Unable to update notifications.';
export function useNotificationInbox({
  startDate = '',
  endDate = '',
}: { startDate?: string; endDate?: string } = {}) {
  const dateQuery = startDate
    ? `&${new URLSearchParams({ startDate, endDate })}`
    : '';
  const { data: session, status } = useSession();
  const token = status === 'authenticated' ? session?.user?.token || '' : '';
  const sessionKey = `${session?.user?.id || ''}:${session?.user?.tenantId || ''}`;
  const scope = `${sessionKey}:${token}${dateQuery}`;
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const mounted = useRef(true),
    controller = useRef<AbortController | null>(null),
    serial = useRef(0);
  const pending = useRef(new Set<string>()),
    ownEvent = useRef(false),
    bulk = useRef(false);
  const [state, setState] = useState({
    scope,
    data: empty(),
    loading: true,
    error: '',
  });
  const stateRef = useRef(state);
  stateRef.current = state;
  const [busyState, setBusy] = useState({ scope, label: '' });
  const valid = useCallback(
    () => mounted.current && currentScope.current === scope,
    [scope]
  );
  const update = useCallback(
    (fn: (data: NotificationPage) => NotificationPage, error?: string) => {
      if (!valid()) return;
      setState((s) =>
        s.scope === scope
          ? {
              ...s,
              data: fn(s.data),
              ...(error === undefined ? {} : { error }),
            }
          : s
      );
    },
    [scope, valid]
  );
  const refresh = useCallback(async () => {
    if (pending.current.size || bulk.current) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const sequence = ++serial.current;
    const active = () =>
      valid() && sequence === serial.current && !abort.signal.aborted;
    if (!token) {
      setState({
        scope,
        data: empty(),
        loading: false,
        error: status === 'loading' ? '' : 'Sign in to view notifications.',
      });
      return;
    }
    setState((s) => ({
      scope,
      data: s.scope === scope ? s.data : empty(),
      loading: true,
      error: '',
    }));
    const notices = new Map<
      string,
      NotificationPage['notifications'][number]
    >();
    try {
      for (let page = 1, fetched = 0; page <= 10; page++) {
        const result = await notificationRequest(
          token,
          `?page=${page}&limit=50${dateQuery}`,
          { signal: abort.signal }
        );
        if (!active()) return;
        for (const notice of result.notifications)
          notices.set(notice._id, notice);
        fetched += result.notifications.length;
        setState({
          scope,
          data: {
            ...result,
            notifications: Array.from(notices.values()).slice(0, 500),
          },
          loading: true,
          error: '',
        });
        if (
          fetched >= Math.min(result.total, 500) ||
          !result.notifications.length
        )
          break;
      }
      if (active()) setState((s) => ({ ...s, loading: false }));
    } catch (e) {
      if (active())
        setState((s) => ({ ...s, loading: false, error: message(e) }));
    }
  }, [scope, token, status, valid, dateQuery]);
  useEffect(() => {
    mounted.current = true;
    pending.current.clear();
    bulk.current = false;
    setBusy({ scope, label: '' });
    void refresh();
    const visible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const changed = (event: Event) => {
      if (
        !ownEvent.current &&
        (event as CustomEvent<string>).detail === sessionKey
      )
        void refresh();
    };
    const timer = token ? window.setInterval(visible, 60000) : undefined;
    document.addEventListener('visibilitychange', visible);
    window.addEventListener(CHANGED, changed);
    return () => {
      mounted.current = false;
      controller.current?.abort();
      if (timer) window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener(CHANGED, changed);
    };
  }, [refresh, scope, token, sessionKey]);
  const publish = () => {
    ownEvent.current = true;
    window.dispatchEvent(new CustomEvent(CHANGED, { detail: sessionKey }));
    ownEvent.current = false;
  };
  const start = () => {
    controller.current?.abort();
    serial.current++;
    setState((s) => ({ ...s, loading: false, error: '' }));
  };
  const markRead = async (id: string, inBatch = false): Promise<boolean> => {
    if (
      !token ||
      !valid() ||
      (bulk.current && !inBatch) ||
      pending.current.has(id) ||
      pending.current.has('*')
    )
      return false;
    const notice =
      stateRef.current.scope === scope
        ? stateRef.current.data.notifications.find((n) => n._id === id)
        : undefined;
    if (!notice || notice.isRead) return true;
    pending.current.add(id);
    start();
    if (!inBatch) setBusy({ scope, label: 'Marking…' });
    update((d) => ({
      ...d,
      unreadCount: Math.max(0, d.unreadCount - 1),
      notifications: d.notifications.map((n) =>
        n._id === id ? { ...n, isRead: true } : n
      ),
    }));
    try {
      await notificationRequest(token, `/${encodeURIComponent(id)}/read`, {
        method: 'PATCH',
      });
      if (!valid()) return false;
      publish();
      return true;
    } catch (e) {
      update(
        (d) => ({
          ...d,
          unreadCount: d.unreadCount + 1,
          notifications: d.notifications.map((n) =>
            n._id === id ? notice : n
          ),
        }),
        message(e)
      );
      return false;
    } finally {
      if (valid()) {
        pending.current.delete(id);
        if (!pending.current.size && !bulk.current)
          setBusy({ scope, label: '' });
      }
    }
  };
  const markManyRead = async (ids: string[]) => {
    if (pending.current.size || bulk.current || !token || !valid()) return;
    bulk.current = true;
    let landed = 0;
    for (const id of ids) {
      if (!valid()) return;
      setBusy({ scope, label: `Marking ${landed + 1} of ${ids.length}…` });
      if (!(await markRead(id, true))) {
        update(
          (d) => d,
          `${landed} of ${ids.length} marked read. Please retry the remaining notices.`
        );
        break;
      }
      landed++;
    }
    if (valid()) {
      bulk.current = false;
      setBusy({ scope, label: '' });
    }
  };
  const markAllRead = async () => {
    if (!token || !valid() || pending.current.size || bulk.current) return;
    pending.current.add('*');
    start();
    setBusy({ scope, label: 'Marking all…' });
    try {
      const result = await notificationRequest<{ modifiedCount: number }>(
        token,
        '/read-all' + (dateQuery ? `?${dateQuery.slice(1)}` : ''),
        { method: 'PATCH' }
      );
      if (!valid()) return;
      update((d) => ({
        ...d,
        unreadCount: Math.max(0, d.unreadCount - result.modifiedCount),
        notifications: d.notifications.map((n) => ({ ...n, isRead: true })),
      }));
      publish();
    } catch (e) {
      update((d) => d, message(e));
    } finally {
      if (valid()) {
        pending.current.delete('*');
        setBusy({ scope, label: '' });
      }
    }
  };
  return {
    data: state.scope === scope ? state.data : empty(),
    loading: status === 'loading' || state.scope !== scope || state.loading,
    error: state.scope === scope ? state.error : '',
    busy: busyState.scope === scope && !!busyState.label,
    busyLabel: busyState.scope === scope ? busyState.label : '',
    scope,
    refresh,
    markRead: (id: string) => markRead(id),
    markManyRead,
    markAllRead,
  };
}

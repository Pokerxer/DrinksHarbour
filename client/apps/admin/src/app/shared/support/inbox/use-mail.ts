'use client';

import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';
import * as api from './api';
import type {
  CustomerContext,
  MailAccount,
  MailFolder,
  MailMessage,
  MessagePage,
  Snippet,
} from './types';

/** The admin session carries the backend JWT the mail API expects. */
export function useMailToken(): string | null {
  const { data: session } = useSession();
  return (session?.user as { token?: string } | undefined)?.token ?? null;
}

interface Resource<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * One loader for every mail resource.
 *
 * error and data are separate state: an error must never be represented as an
 * empty result, or an unreachable mail server renders as "no messages".
 */
function useResource<T>(
  loader: (token: string) => Promise<T>,
  deps: unknown[],
  enabled = true
): Resource<T> {
  const token = useMailToken();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!token || !enabled) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    loader(token)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setData(null);
          setError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, enabled, nonce, ...deps]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, reload };
}

/** `refresh` refetches after an account is added or removed. */
export const useMailAccounts = (refresh = 0): Resource<MailAccount[]> =>
  useResource((token) => api.fetchAccounts(token), [refresh]);

/**
 * `refresh` is the mailRefreshAtom counter. It is a dependency but not part of
 * the request, so bumping it refetches without changing what is asked for —
 * that is how opening a message clears its own unread badge in the rail and its
 * bold styling in the list.
 */
export const useMailFolders = (
  accountId: string | null,
  refresh = 0
): Resource<MailFolder[]> =>
  useResource(
    (token) => api.fetchFolders(token, accountId as string),
    [accountId, refresh],
    Boolean(accountId)
  );

export const useMailMessages = (
  accountId: string | null,
  params: {
    folder: string;
    page: number;
    search: string;
    refresh?: number;
    limit?: number;
    unread?: boolean;
    unanswered?: boolean;
  }
): Resource<MessagePage> =>
  useResource(
    (token) =>
      api.fetchMessages(token, accountId as string, {
        folder: params.folder,
        page: params.page,
        search: params.search,
        limit: params.limit,
        unread: params.unread,
        unanswered: params.unanswered,
      }),
    [
      accountId,
      params.folder,
      params.page,
      params.search,
      params.limit,
      params.unread ?? false,
      params.unanswered ?? false,
      params.refresh ?? 0,
    ],
    Boolean(accountId)
  );

/** `refresh` refetches after a snippet is created, edited or deleted. */
export const useSnippets = (refresh = 0): Resource<Snippet[]> =>
  useResource((token) => api.fetchSnippets(token), [refresh]);

/**
 * The sender's customer record. Disabled until there is an address to ask
 * about, so the panel never fires a request for a message with no From.
 */
export const useCustomerContext = (
  email: string | null
): Resource<CustomerContext> =>
  useResource(
    (token) => api.fetchCustomerContext(token, email as string),
    [email],
    Boolean(email)
  );

export const useMailMessage = (
  accountId: string | null,
  folder: string | null,
  uid: number | null,
  showImages: boolean
): Resource<MailMessage> =>
  useResource(
    (token) =>
      api.fetchMessage(
        token,
        accountId as string,
        folder as string,
        uid as number,
        showImages
      ),
    [accountId, folder, uid, showImages],
    Boolean(accountId && folder && uid)
  );

'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { occasionRequestService, type HistoryMessage, type HistoryPage } from '@/services/occasionRequest.service';

/** Message count after which the server page is "full" and the reader
 * re-pages immediately instead of waiting for the next tick. */
export const FULL_PAGE = 30;

/** Deduped, ascending merge of known + incoming messages. */
export function mergeHistory(messages: HistoryMessage[], incoming: HistoryMessage[]): HistoryMessage[] {
  return [...new Map([...messages, ...incoming].map(row => [row._id, row])).values()].sort((a, b) => a._id.localeCompare(b._id));
}

/** Keep loaded earlier history when a full read window re-arrives (only the
 * newest 30): if the fresh window shares no known ids with a previously
 * opened pane, the thread is being re-read from scratch, so the fresh
 * `olderCursor` wins. Mirrors the platform's `mergeConversationHistory`. */
export function combineHistory(
  previous: { messages: HistoryMessage[]; olderCursor: string | null } | undefined,
  next: HistoryPage
): { messages: HistoryMessage[]; olderCursor: string | null } {
  const known = new Set((previous?.messages || []).map(row => row._id));
  const gap = Boolean(previous?.messages.length && next.messages.length && next.olderCursor && !next.messages.some(row => known.has(row._id)));
  return {
    messages: mergeHistory(previous?.messages || [], next.messages),
    olderCursor: !previous || gap ? next.olderCursor : previous.olderCursor,
  };
}

export type StaffHistory = {
  messages: HistoryMessage[];
  olderCursor: string | null;
  error: string;
  load: () => void;
  loadEarlier: () => void;
  earlierBusy: boolean;
};

/** Staff conversation reader with the same correctness shape as the customer
 * thread (the platform app's lib/incrementalThread): the initial read is a
 * full newest-30 read (which doubles as the server-side staff read watermark
 * — DRI-41; reading the open pane IS the read call), every later visible-tab
 * tick reads `GET /:id/messages?after=<last server _id>` (the DRI-26
 * contract), merging only strictly-newer messages, while any unclear or
 * errored response degrades to the full read in the same tick. A full
 * 30-message page chains into the next read inside the same tick. */
export function useStaffHistory(token: string, id: string, revision: number | string): StaffHistory {
  const [messages, setMessages] = useState<HistoryMessage[]>([]);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [earlierBusy, setEarlierBusy] = useState(false);
  const alive = useRef(true), pollBusy = useRef(false), cursorTrusted = useRef(false), earlierBusyRef = useRef(false);
  const store = useRef<{ messages: HistoryMessage[]; olderCursor: string | null }>({ messages: [], olderCursor: null });

  const commit = useCallback((next: { messages: HistoryMessage[]; olderCursor: string | null }) => {
    store.current = next;
    setMessages(next.messages);
    setOlderCursor(next.olderCursor);
  }, []);

  const fullRead = useCallback(async (): Promise<boolean> => {
    const value: HistoryPage = await occasionRequestService.history(token, id);
    if (!alive.current) return false;
    // An empty prior store is no history at all — only pass prior objects that
    // carry messages so a fresh read's olderCursor is never discarded.
    commit(combineHistory(store.current.messages.length ? store.current : undefined, value));
    return true;
  }, [token, id, commit]);

  const pollTick = useCallback(async () => {
    if (!alive.current || pollBusy.current) return;
    pollBusy.current = true;
    try {
      for (let pass = 0; pass < 60; pass++) {
        const previous = store.current;
        const after = previous.messages.length ? previous.messages[previous.messages.length - 1]._id : '';
        if (!cursorTrusted.current || !after) {
          await fullRead();
          cursorTrusted.current = true;
          break;
        }
        let value: HistoryPage;
        try {
          value = await occasionRequestService.history(token, id, `after=${after}`);
        } catch {
          cursorTrusted.current = false; // degrade to the full read, this tick
          continue;
        }
        if (!alive.current) return;
        if (value.messages.some(row => row._id.localeCompare(after) <= 0)) {
          cursorTrusted.current = false; // the server echoed at-or-before the cursor → full read this tick
          continue;
        }
        if (value.messages.length) commit({ messages: mergeHistory(previous.messages, value.messages), olderCursor: previous.olderCursor });
        if (value.messages.length < FULL_PAGE) break;
      }
      if (alive.current) setError('');
    } catch (failure) {
      if (alive.current) {
        setError(failure instanceof Error ? failure.message : 'Conversation could not be refreshed. Try again before replying.');
      }
    } finally {
      pollBusy.current = false;
    }
  }, [fullRead]);

  const load = useCallback(() => void pollTick(), [pollTick]);

  const loadEarlier = useCallback(async () => {
    const cursor = store.current.olderCursor;
    if (!cursor || earlierBusyRef.current) return;
    earlierBusyRef.current = true;
    setEarlierBusy(true);
    try {
      const value: HistoryPage = await occasionRequestService.history(token, id, `before=${cursor}`);
      if (alive.current) commit({ messages: mergeHistory(store.current.messages, value.messages), olderCursor: value.olderCursor });
    } catch {
      if (alive.current) setError('Earlier messages could not be loaded.');
    } finally {
      if (alive.current) {
        earlierBusyRef.current = false;
        setEarlierBusy(false);
      }
    }
  }, [token, id, commit]);

  useEffect(() => {
    alive.current = true;
    pollBusy.current = false;
    cursorTrusted.current = false;
    store.current = { messages: [], olderCursor: null };
    setMessages([]);
    setOlderCursor(null);
    setError('');
    setEarlierBusy(false);
    void pollTick();
    const timer = setInterval(() => { if (!document.hidden) void pollTick(); }, 10000);
    return () => { alive.current = false; clearInterval(timer); };
  }, [pollTick, token, id, revision]);

  return { messages, olderCursor, error, load, loadEarlier, earlierBusy };
}

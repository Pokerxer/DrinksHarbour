'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { customerConversation, type ChatMessage, type Conversation } from '@/lib/customerConversation';
import { FULL_PAGE, incrementalSplit, newestServerId } from '@/lib/incrementalThread';

const unique = (messages: ChatMessage[]) =>
  [...new Map(messages.map(message => [message._id, message])).values()].sort((a, b) => a._id.localeCompare(b._id));

/** Customer bubble that exists only on the client between send and server
 * confirmation. `local:<uuid>` keeps it out of the server `_id` cursor math
 * (unread/seenId), and the uuid doubles as the idempotency messageKey so a
 * retry re-POSTs the exact same key. */
export type LocalChatMessage = ChatMessage & { local: 'sending' | 'failed'; error?: string };
export type OccasionThreadMessage = ChatMessage | LocalChatMessage;

export type OccasionThread = {
  messages: OccasionThreadMessage[];
  loading: boolean;
  loadError: string;
  sending: boolean;
  unreadCount: number;
  lastCheckedAt: string;
  /** Request status from the backend status payload (pending/draft/sending/sent/delivery_failed). */
  status: string;
  /** Queues the message optimistically (pending bubble + cleared composer) and
   * returns immediately; failures surface inline on the bubble. The same-text
   * UUID key behavior is unchanged. */
  send: (content: string, existingLocalId?: string) => boolean;
  /** Re-POSTs a failed bubble's exact text with the exact same UUID key. */
  retryMessage: (message: OccasionThreadMessage) => void;
  refresh: () => void;
};

/** How many pages one tick may chain when the server answers with full
 * 30-message pages. Guards against a pathological loop; normal churn drains
 * in one or two chained reads. */
const MAX_CHAINED_PASSES = 60;

/**
 * Reads the customer's EXISTING occasion conversation through the live
 * /api/occasion-requests endpoints — the same thread as /my-account/chat/[id].
 * The initial load is the full read; every later 10 s visible-tab tick reads
 * incrementally with `?after=<last server _id>` (DRI-26) and merges only
 * newer messages plus the brief `status`, re-paging immediately whenever a
 * full 30-message page comes back. Any error or unclear cursor semantics
 * degrade to a full read in the same tick. Unread counts stay session-derived
 * inside this hook for instant display; the server's own read-mark
 * (`lastCustomerReadAt`) is drained by these same reads when the pane is open,
 * and the authoritative unread badges on closed surfaces come from
 * `customerUnreadCount` on /mine (ConversationList/nav — not this hook).
 * `reading` is true while the modal is open: only then does "seen" advance.
 */
export function useOccasionThread(conversationId: string, reading: boolean): OccasionThread {
  const [serverMessages, setServerMessages] = useState<ChatMessage[]>([]);
  const [localMessages, setLocalMessages] = useState<LocalChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastCheckedAt, setLastCheckedAt] = useState('');
  const [status, setStatus] = useState('');
  const alive = useRef(true), generation = useRef(0), pending = useRef(false), busy = useRef(false), cursorTrusted = useRef(false);
  const seenId = useRef(''), readingRef = useRef(reading), messageKey = useRef({ text: '', value: '' });
  const serverRef = useRef<ChatMessage[]>([]);
  readingRef.current = reading;

  const messages = useMemo(() => [...serverMessages, ...localMessages], [serverMessages, localMessages]);

  /** One authoritative write into the hook's server list — pure server data,
   * `local:*` ids never reach this math. */
  const reduce = useCallback((list: ChatMessage[]) => {
    serverRef.current = unique(list);
    setServerMessages(serverRef.current);
    setLastCheckedAt(new Date().toISOString());
    if (readingRef.current) {
      const latest = serverRef.current[serverRef.current.length - 1];
      if (latest) seenId.current = latest._id;
      setUnreadCount(0);
      return;
    }
    setUnreadCount(serverRef.current.filter(message => message.sender === 'staff' && message._id.localeCompare(seenId.current) > 0).length);
  }, []);

  /** Full read: the initial load, the manual refresh and the fallback for
   * every error or unclear cursor response. */
  const readFull = useCallback(async (gen: number) => {
    const data = await customerConversation.read(conversationId);
    if (!alive.current || gen !== generation.current) return;
    reduce(data.messages);
    if (data.request?.status) setStatus(data.request.status);
    setLoadError('');
    setLoading(false);
  }, [conversationId, reduce]);

  /** One visible-tab tick: incremental after-cursor reads while the thread
   * stays fresh, a full read whenever they are not (no cursor yet, error, or
   * the server echoed at-or-before-cursor ids). A full page chains into the
   * next read within this tick; a short page waits for the next tick. */
  const pollTick = useCallback(async () => {
    if (!alive.current || busy.current) return;
    busy.current = true;
    const gen = generation.current;
    try {
      for (let pass = 0; pass < MAX_CHAINED_PASSES; pass++) {
        const after = newestServerId(serverRef.current);
        if (!cursorTrusted.current || !after) {
          await readFull(gen);
          cursorTrusted.current = true;
          break;
        }
        let data: Conversation;
        try {
          data = await customerConversation.read(conversationId, { after });
        } catch {
          cursorTrusted.current = false; // degrade to the full read, this tick
          continue;
        }
        if (!alive.current || gen !== generation.current) return;
        const { newer, clear } = incrementalSplit(data.messages, after);
        if (!clear || !data.request) {
          cursorTrusted.current = false; // semantics unclear → full read
          continue;
        }
        reduce(unique([...serverRef.current, ...newer]));
        if (data.request.status) setStatus(data.request.status);
        if (newer.length < FULL_PAGE) break;
      }
    } catch (failure) {
      if (!alive.current || gen !== generation.current) return;
      setLoadError(failure instanceof Error && failure.message ? failure.message : 'Conversation unavailable. Please retry.');
      setLoading(false);
    } finally {
      busy.current = false;
    }
  }, [conversationId, reduce, readFull]);

  const queueSend = useCallback((content: string, existingLocalId?: string) => {
    const value = content.trim();
    if (!value || pending.current) return false;
    const uuid = existingLocalId?.startsWith('local:')
      ? existingLocalId.slice('local:'.length) || crypto.randomUUID()
      : messageKey.current.text === value ? messageKey.current.value : crypto.randomUUID();
    messageKey.current = { text: value, value: uuid };
    const localId = `local:${uuid}`;
    pending.current = true;
    setSending(true);
    setLocalMessages(current => {
      const previous = existingLocalId ? current.find(entry => entry._id === localId) : undefined;
      return [...current.filter(entry => entry._id !== localId), {
        _id: localId, sender: 'customer' as const, content: value,
        createdAt: previous?.createdAt ?? new Date().toISOString(), local: 'sending' as const,
      }];
    });
    void (async () => {
      try {
        const message = await customerConversation.send(conversationId, value, uuid);
        if (!alive.current) return;
        setLocalMessages(current => current.filter(entry => entry._id !== localId));
        reduce(unique([...serverRef.current, message]));
        messageKey.current = { text: '', value: '' };
      } catch (failure) {
        if (!alive.current) return;
        const error = failure instanceof Error && failure.message ? failure.message : 'Your message could not be sent. Retry with the same text.';
        setLocalMessages(current => current.map(entry => entry._id === localId ? { ...entry, local: 'failed' as const, error } : entry));
      } finally {
        if (alive.current) {
          pending.current = false;
          setSending(false);
        }
      }
    })();
    return true;
  }, [conversationId, reduce]);

  const send = useCallback((content: string, existingLocalId?: string) => queueSend(content, existingLocalId), [queueSend]);

  const retryMessage = useCallback((message: OccasionThreadMessage) => {
    if (message._id.startsWith('local:')) queueSend(message.content, message._id);
  }, [queueSend]);

  const refresh = useCallback(() => void pollTick(), [pollTick]);

  useEffect(() => {
    generation.current++;
    alive.current = true;
    pending.current = false;
    busy.current = false;
    seenId.current = '';
    messageKey.current = { text: '', value: '' };
    cursorTrusted.current = false;
    serverRef.current = [];
    setServerMessages([]); setLocalMessages([]); setLoading(true); setLoadError(''); setSending(false); setUnreadCount(0); setLastCheckedAt(''); setStatus('');
    void pollTick();
    const timer = setInterval(() => { if (!document.hidden) void pollTick(); }, 10000);
    return () => { alive.current = false; generation.current++; clearInterval(timer); };
  }, [pollTick]);

  return { messages, loading, loadError, sending, unreadCount, lastCheckedAt, status, send, retryMessage, refresh };
}

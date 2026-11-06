'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { customerConversation, type ChatMessage } from '@/lib/customerConversation';

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

/**
 * Reads the customer's EXISTING occasion conversation through the live
 * /api/occasion-requests endpoints — the same thread as /my-account/chat/[id].
 * Polls every 10s while the tab is visible (ConversationPage pattern). Unread
 * counts are computed purely client-side from the server message list; the
 * backend has no read state, no websockets and nothing writes here
 * automatically. `reading` is true while the modal is open: only then does
 * "seen" advance.
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
  const alive = useRef(true), sequence = useRef(0), pending = useRef(false);
  const seenId = useRef(''), readingRef = useRef(reading), messageKey = useRef({ text: '', value: '' });
  readingRef.current = reading;

  const messages = useMemo(() => [...serverMessages, ...localMessages], [serverMessages, localMessages]);

  const apply = useCallback((list: ChatMessage[]) => {
    // `list` is server data only — local `local:*` ids never reach this math.
    setServerMessages(list);
    setLastCheckedAt(new Date().toISOString());
    if (readingRef.current) {
      const latest = list[list.length - 1];
      if (latest) seenId.current = latest._id;
      setUnreadCount(0);
      return;
    }
    setUnreadCount(list.filter(message => message.sender === 'staff' && message._id.localeCompare(seenId.current) > 0).length);
  }, []);

  const load = useCallback(async () => {
    const current = ++sequence.current;
    try {
      const data = await customerConversation.read(conversationId);
      if (!alive.current || current !== sequence.current) return;
      apply(unique(data.messages));
      if (data.request?.status) setStatus(data.request.status);
      setLoadError('');
      setLoading(false);
    } catch (failure) {
      if (!alive.current || current !== sequence.current) return;
      setLoadError(failure instanceof Error && failure.message ? failure.message : 'Conversation unavailable. Please retry.');
      setLoading(false);
    }
  }, [conversationId, apply]);

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
        setServerMessages(current => unique([...current, message]));
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
  }, [conversationId]);

  const send = useCallback((content: string, existingLocalId?: string) => queueSend(content, existingLocalId), [queueSend]);

  const retryMessage = useCallback((message: OccasionThreadMessage) => {
    if (message._id.startsWith('local:')) queueSend(message.content, message._id);
  }, [queueSend]);

  useEffect(() => {
    alive.current = true;
    sequence.current = 0;
    pending.current = false;
    seenId.current = '';
    messageKey.current = { text: '', value: '' };
    setServerMessages([]); setLocalMessages([]); setLoading(true); setLoadError(''); setSending(false); setUnreadCount(0); setLastCheckedAt(''); setStatus('');
    void load();
    const timer = setInterval(() => { if (!document.hidden) void load(); }, 10000);
    return () => { alive.current = false; sequence.current++; clearInterval(timer); };
  }, [load]);

  const refresh = useCallback(() => void load(), [load]);
  return { messages, loading, loadError, sending, unreadCount, lastCheckedAt, status, send, retryMessage, refresh };
}

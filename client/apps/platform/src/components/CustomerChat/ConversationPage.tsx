'use client';
import Link from 'next/link';
import { mergeConversationHistory } from '@/lib/conversationHistory';
import { useCallback, useEffect, useRef, useState } from 'react';
import { customerConversation, type Conversation, type ChatMessage } from '@/lib/customerConversation';
import { useAuth } from '@/context/AuthContext';
import { isAuthChatError } from '@/lib/chatFormatting';
import { chatStatusCopy } from '@/lib/chatStatus';
import { FULL_PAGE, incrementalSplit, newestServerId } from '@/lib/incrementalThread';
import ChatHeader from '@/components/chat-ui/ChatHeader';
import ChatComposer from '@/components/chat-ui/ChatComposer';
import ChatThread from './ChatThread';
const unique = (messages: ChatMessage[]) => [...new Map(messages.map(message => [message._id, message])).values()].sort((a, b) => a._id.localeCompare(b._id));
/** How many incremental pages one tick may chain when the server answers
 * with full 30-message pages (same bound as useOccasionThread). */
const MAX_CHAINED_PASSES = 60;
export default function ConversationPage({ id }: { id: string }) {
  const { token, user } = useAuth();
  const [data, setData] = useState<Conversation | undefined>(), [text, setText] = useState(''), [error, setError] = useState(''), [sending, setSending] = useState(false), [olderBusy, setOlderBusy] = useState(false), [loadError, setLoadError] = useState('');
  const pending = useRef(false), key = useRef({ text: '', value: '' }), alive = useRef(true), sequence = useRef(0), context = useRef(Symbol());
  const pollBusy = useRef(false), cursorTrusted = useRef(false), dataRef = useRef<Conversation | undefined>(undefined);
  const invalidate = useCallback(() => { sequence.current++; }, []);
  /** Every subscribed write also mirrors into dataRef so the poller can read
   * the latest server cursor without a state race (no optimistic sends live
   * here — every document in dataRef is a server message). */
  const write = useCallback((next: Conversation | undefined) => { dataRef.current = next; setData(next); }, []);
  const fullRead = useCallback(async (current: number) => {
    const value = await customerConversation.read(id);
    if (!alive.current || current !== sequence.current) return;
    const prior = dataRef.current, merged = { ...value, ...mergeConversationHistory(prior, value) };
    write(merged);
    setLoadError('');
  }, [id, write]);

  const poll = useCallback(async () => {
    if (!token || !alive.current || pollBusy.current) return;
    pollBusy.current = true;
    const current = ++sequence.current;
    try {
      for (let pass = 0; pass < MAX_CHAINED_PASSES; pass++) {
        const prior = dataRef.current, after = prior ? newestServerId(prior.messages) : '';
        if (!cursorTrusted.current || !prior || !after) {
          await fullRead(current);
          cursorTrusted.current = true;
          break;
        }
        let value: Conversation;
        try {
          value = await customerConversation.read(id, { after });
        } catch {
          cursorTrusted.current = false; // degrade to the full read, this tick
          continue;
        }
        if (!alive.current || current !== sequence.current) return;
        const { newer, clear } = incrementalSplit(value.messages, after);
        if (!clear || !value.request) {
          cursorTrusted.current = false; // semantics unclear → full read (keeps earlier history merged)
          continue;
        }
        write({ ...prior, request: value.request, messages: unique([...prior.messages, ...newer]), olderCursor: prior.olderCursor });
        setError('');
        if (newer.length < FULL_PAGE) break;
      }
    } catch (failure) {
      if (alive.current && current === sequence.current) {
        setLoadError(failure instanceof Error ? failure.message : 'Conversation unavailable.');
      }
    } finally {
      pollBusy.current = false;
    }
  }, [id, token, fullRead, write]);

  const load = useCallback(() => poll(), [poll]);

  useEffect(() => {
    alive.current = true;
    context.current = Symbol();
    pending.current = false;
    key.current = { text: '', value: '' };
    pollBusy.current = false;
    cursorTrusted.current = false;
    dataRef.current = undefined;
    setSending(false);
    setOlderBusy(false);
    setLoadError('');
    setData(undefined);
    setText('');
    setError('');
    void load();
    const timer = setInterval(() => { if (!document.hidden) void poll(); }, 10000);
    return () => {
      alive.current = false;
      context.current = Symbol();
      invalidate();
      clearInterval(timer);
    };
  }, [load, user?._id, poll, invalidate]);

  async function attemptSend() {
    const currentContext = context.current;
    const content = text.trim();
    if (!content || pending.current || sending) return;
    if (key.current.text !== content) key.current = { text: content, value: crypto.randomUUID() };
    pending.current = true;
    setSending(true);
    setError('');
    try {
      const message = await customerConversation.send(id, content, key.current.value);
      if (alive.current && currentContext === context.current) {
        const prior = dataRef.current;
        if (prior) write({ ...prior, messages: unique([...prior.messages, message]) });
        setText('');
        key.current = { text: '', value: '' };
      }
    } catch (failure) {
      if (alive.current && currentContext === context.current) {
        setError(failure instanceof Error ? failure.message : 'Your message could not be sent. Retry with the same text.');
      }
    } finally {
      if (alive.current && currentContext === context.current) {
        pending.current = false;
        setSending(false);
      }
    }
  }

  async function earlier() {
    const prior = dataRef.current;
    if (!prior?.olderCursor || olderBusy) return;
    const currentContext = context.current;
    setOlderBusy(true);
    setError('');
    try {
      const result = await customerConversation.read(id, { before: prior.olderCursor });
      if (alive.current && currentContext === context.current) {
        write({ ...prior, messages: unique([...result.messages, ...prior.messages]), olderCursor: result.olderCursor });
      }
    } catch {
      if (alive.current && currentContext === context.current) setError('Earlier messages could not be loaded. Try again.');
    } finally {
      if (alive.current && currentContext === context.current) setOlderBusy(false);
    }
  }
  const brief = data?.request;
  const replied = !!data?.messages.some(message => message.sender === 'staff');
  const statusLine = brief ? chatStatusCopy(brief.status, replied, 'page') : null;
  const problem = error || loadError;
  const occasionTitle = brief ? `${brief.occasion.replaceAll('-', ' ')} drinks` : 'Your conversation';
  return <section className="space-y-5">
    {problem && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-800">{problem}{isAuthChatError(problem) && <Link href={`/login?redirect=${encodeURIComponent(`/my-account/chat/${id}`)}&reason=expired`} className="ml-2 font-semibold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]">Sign in to continue</Link>}<button type="button" className="ml-2 inline-flex min-h-11 items-center rounded-lg px-2 font-semibold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]" onClick={() => { setError(''); void load(); }}>Refresh conversation</button></p>}
    {!data && !loadError ? <><div className="rounded-xl border border-gray-200 bg-white p-5"><h1 className="text-2xl font-bold">{occasionTitle}</h1><p className="mt-2 text-sm text-gray-500">Chat with the DrinksHarbour planning team</p></div><p role="status" className="rounded-xl bg-gray-50 p-6 text-sm text-gray-600">Loading conversation…</p></> : data &&
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <ChatHeader back={{ href: '/my-account/chat', label: 'All conversations' }} icon={brief?.occasion.slice(0, 1)} title={occasionTitle} subtitle={brief ? `${brief.reference} · Chat with the DrinksHarbour planning team` : undefined} />
        {statusLine && <div className="border-b border-gray-100 bg-[#fff8ec] px-4 py-2"><p className="text-xs leading-6 text-[#351014]"><strong className="font-semibold">{statusLine.lead}</strong> {statusLine.detail}</p></div>}
        <ChatThread data={data} olderBusy={olderBusy} onEarlier={() => void earlier()} onDownload={name => { setError(''); void customerConversation.download(id, name).catch(() => setError('Attachment unavailable. Please retry.')); }} />
      </div>}
    {data && <ChatComposer id="customer-chat-message" label="Message our team" hint="Avoid payment or private guest details." hintId="customer-chat-hint" buttonLabel="Send message" sendingLabel="Sending…" sending={sending} value={text} onChange={value => setText(value)} onSend={() => void attemptSend()} />}
  </section>;
}

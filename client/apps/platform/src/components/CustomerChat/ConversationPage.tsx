'use client';
import Link from 'next/link';
import { mergeConversationHistory } from '@/lib/conversationHistory';
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { customerConversation, type Conversation, type ChatMessage } from '@/lib/customerConversation';
import { useAuth } from '@/context/AuthContext';
import { chatDayLabel, chatTimeLabel, isAuthChatError } from '@/lib/chatFormatting';
import { chatStatusCopy } from '@/lib/chatStatus';
import { enterSubmitsMessage } from '@/lib/chatKeyboard';
const unique = (messages: ChatMessage[]) => [...new Map(messages.map(message => [message._id, message])).values()].sort((a, b) => a._id.localeCompare(b._id));
function dayGroups(messages: ChatMessage[]) {
  const groups: { label: string; items: ChatMessage[] }[] = [];
  for (const message of messages) {
    const label = chatDayLabel(message.createdAt);
    const current = groups[groups.length - 1];
    if (current && current.label === label) current.items.push(message);
    else groups.push({ label, items: [message] });
  }
  return groups;
}
export default function ConversationPage({ id }: { id: string }) {
  const { token, user } = useAuth();
  const [data, setData] = useState<Conversation>(), [text, setText] = useState(''), [error, setError] = useState(''), [sending, setSending] = useState(false), [olderBusy, setOlderBusy] = useState(false), [loadError, setLoadError] = useState('');
  const pending = useRef(false), key = useRef({ text: '', value: '' }), alive = useRef(true), sequence = useRef(0), context = useRef(Symbol());
  const invalidate = useCallback(() => { sequence.current++; }, []);
  const load = useCallback(async () => {
    if (!token) return;
    const current = ++sequence.current;
    try {
      const value = await customerConversation.read(id);
      if (alive.current && current === sequence.current) {
        setData(prior => ({ ...value, ...mergeConversationHistory(prior, value) }));
        setLoadError('');
      }
    } catch (failure) {
      if (alive.current && current === sequence.current) {
        setLoadError(failure instanceof Error ? failure.message : 'Conversation unavailable.');
      }
    }
  }, [id, token]);

  useEffect(() => {
    alive.current = true;
    context.current = Symbol();
    pending.current = false;
    key.current = { text: '', value: '' };
    setSending(false);
    setOlderBusy(false);
    setLoadError('');
    setData(undefined);
    setText('');
    setError('');
    void load();
    const timer = setInterval(() => { if (!document.hidden) void load(); }, 10000);
    return () => {
      alive.current = false;
      context.current = Symbol();
      invalidate();
      clearInterval(timer);
    };
  }, [load, user?._id, invalidate]);

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
        setData(prior => prior ? { ...prior, messages: unique([...prior.messages, message]) } : prior);
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

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await attemptSend();
  }

  function composeKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!enterSubmitsMessage(event.nativeEvent)) return;
    event.preventDefault();
    void attemptSend();
  }

  async function earlier() {
    if (!data?.olderCursor || olderBusy) return;
    const currentContext = context.current;
    setOlderBusy(true);
    setError('');
    try {
      const result = await customerConversation.read(id, data.olderCursor);
      if (alive.current && currentContext === context.current) {
        setData(prior => prior ? { ...prior, messages: unique([...result.messages, ...prior.messages]), olderCursor: result.olderCursor } : result);
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
  return <section className="space-y-5"><Link href="/my-account/chat" className="inline-flex min-h-11 items-center text-sm font-semibold text-[#7c1d1d] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">← All conversations</Link><div className="rounded-xl border border-gray-200 bg-white p-5"><h1 className="text-2xl font-bold">{brief ? `${brief.occasion.replaceAll('-', ' ')} drinks` : 'Your conversation'}</h1><p className="mt-2 text-sm text-gray-500">{brief?.reference} · Chat with the DrinksHarbour planning team</p>{statusLine && <p className="mt-3 text-sm leading-6 text-gray-700"><strong className="font-semibold">{statusLine.lead}</strong> {statusLine.detail}</p>}<p className="mt-2 text-xs leading-6 text-gray-500">Messages stay in your profile. You can leave and return whenever you need. We aim to reply in about 30 minutes; busy periods may take longer.</p></div>{problem && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{problem}{isAuthChatError(problem) && <Link href={`/login?redirect=${encodeURIComponent(`/my-account/chat/${id}`)}&reason=expired`} className="ml-2 font-semibold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]">Sign in to continue</Link>}<button className="ml-2 inline-flex min-h-11 items-center rounded-lg px-2 font-semibold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]" onClick={() => { setError(''); void load(); }}>Refresh conversation</button></p>}
    {!data && !loadError ? <p role="status" className="rounded-xl bg-gray-50 p-6 text-sm text-gray-600">Loading conversation…</p> : data && <><div role="log" aria-label="Conversation with our team" aria-live="polite" className="space-y-5 rounded-xl border border-gray-200 bg-white p-4 sm:p-6"><article className="ml-auto max-w-[92%] rounded-xl bg-rose-50 p-4"><p className="text-xs font-bold text-[#7c1d1d]">You · original request</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7">{[`${brief?.city}${brief?.date ? ` · ${brief.date}` : ''}`, brief?.guests ? `${brief.guests} guests` : '', brief?.budget ? `Drinks budget: ₦${brief.budget.toLocaleString('en-NG')}` : '', brief?.preferences.length ? `Preferences: ${brief.preferences.join(', ')}` : '', brief?.notes, ...(brief?.items.map(item => `${item.quantity} × ${item.name}`) || [])].filter(Boolean).join('\n')}</p>{brief?.attachment && <button className="mt-3 min-h-11 break-all text-left text-sm font-semibold underline" onClick={() => void customerConversation.download(id, brief.attachment!.name).catch(() => setError('Attachment unavailable. Please retry.'))}>Download {brief.attachment.name}</button>}</article>
      {data.olderCursor && <button disabled={olderBusy} className="min-h-11 rounded-lg text-sm font-semibold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]" onClick={() => void earlier()}>{olderBusy ? 'Loading…' : 'Load earlier messages'}</button>}{dayGroups(data.messages).map(group => <section key={group.label + String(group.items[0] ? group.items[0]._id : '')}><p className="text-center text-xs font-semibold uppercase tracking-wider text-gray-500">{group.label}</p>{group.items.map(message => <article key={message._id} className={`max-w-[92%] rounded-xl p-4 ${message.sender === 'customer' ? 'ml-auto bg-rose-50' : 'mr-auto bg-emerald-50'}`}><p className="text-xs font-bold text-[#7c1d1d]">{message.sender === 'customer' ? 'You' : 'DrinksHarbour team'}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7">{message.content}</p><p className="mt-2 text-xs text-gray-600">{chatTimeLabel(message.createdAt)} WAT</p></article>)}</section>)}{!data.messages.length && <p className="text-sm leading-7 text-gray-500">Your request is with our team. Their reply will appear here.</p>}</div>
      <form onSubmit={send} className="rounded-xl border border-gray-200 bg-white p-4"><label htmlFor="customer-chat-message" className="text-sm font-semibold">Message our team</label><textarea id="customer-chat-message" onKeyDown={composeKeyDown} className="mt-2 w-full rounded-lg border border-gray-300 p-3 text-base focus:border-[#7c1d1d] focus:outline-none focus:ring-2 focus:ring-[#7c1d1d]/20" rows={3} aria-describedby="customer-chat-hint" maxLength={4000} disabled={sending} value={text} onChange={event => setText(event.target.value)} placeholder="Add details, ask a question or tell us what you’d like to change…" /><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p id="customer-chat-hint" className="text-xs leading-6 text-gray-600">{text.length}/4,000 · Avoid payment or private guest details.</p><button disabled={sending || !text.trim()} className="min-h-11 rounded-full bg-[#7c1d1d] px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-[#571419] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7c1d1d] disabled:opacity-50">{sending ? 'Sending…' : 'Send message'}</button></div></form></>}
  </section>;
}

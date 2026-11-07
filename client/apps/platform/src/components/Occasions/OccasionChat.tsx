'use client';

import { useEffect, useId, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react';
import type { OccasionGeneration } from '@/lib/occasionGeneration';
import { PiChatCircleDotsBold } from 'react-icons/pi';
import { useWeddingAiChat } from '@/components/Weddings/useWeddingAiChat';
import { useTenant } from '@/context/TenantContext';
import WeddingAiTranscript from '@/components/Weddings/WeddingAiTranscript';
import { validateBottleList, type BottleListItem, type BottleChoice } from '@/lib/weddingBottleList';
import { weddingAiTasks } from '@/lib/weddingChatPrompt';
import OccasionChatComposer from './OccasionChatComposer';

export type OccasionChatHandle = { open: () => void; start: (details: string, attachment?: File, generation?: OccasionGeneration) => Promise<boolean> };

const labels: Record<string, string> = { weddings: 'wedding', corporate: 'corporate event', 'house-parties': 'house party', gifting: 'gift', bulk: 'bulk order', general: 'occasion' };
type Props = { occasion?: string; items?: BottleListItem[]; interests?: string; children?: ReactNode; onChoose?: (choice: BottleChoice) => string; chatRef?: Ref<OccasionChatHandle>; deferred?: boolean; onBusyChange?: (busy: boolean) => void };
export default function OccasionChat(props: Props) {
  const { tenant } = useTenant();
  return <OccasionChatSession key={`${tenant?._id || 'marketplace'}:${props.occasion || 'general'}`} {...props} />;
}
function OccasionChatSession({ occasion = 'general', items = [], interests = '', children, onChoose, chatRef, deferred = false, onBusyChange }: Props) {
  const titleId = useId();
  const [direct, setDirect] = useState(false);
  const [opened, setOpened] = useState(!deferred), [starts, setStarts] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const [selectionNotice, setSelectionNotice] = useState('');
  const [question, setQuestion] = useState(''), [attachment, setAttachment] = useState<File>();
  const chat = useWeddingAiChat(items, interests, occasion, direct), draftError = validateBottleList(items), listError = direct ? undefined : draftError;
  const label = labels[occasion] || 'occasion';
  useEffect(() => { onBusyChange?.(chat.loading); }, [chat.loading, onBusyChange]);
  useEffect(() => { if (opened && starts) { heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView?.({ block: 'start', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); } }, [opened, starts]);
  function open() { setDirect(true); setOpened(true); setStarts(count => count + 1); }
  useImperativeHandle(chatRef, () => ({ open, start: async (details, file, generation) => { open(); setDirect(false); return chat.ask(generation ? `Prepare a complete beverage plan for my ${label}, allocating my full drinks budget for the total guest count and selected categories. Include actual catalogue quantities/prices, serving coverage, water/mixers, assumptions and any shortfalls. Improve quality rather than overbuying alcohol. Ask what you need to confirm next.` : `Help me plan this ${label}. Review my chosen bottles and event details, then ask the most useful next question.`, file, details, generation); } }));
  async function send() { if (await chat.ask(question, attachment)) { setQuestion(''); setAttachment(undefined); } }
  async function quick(prompt: string) { if (await chat.ask(prompt, attachment)) setAttachment(undefined); }
  async function retry() { if (await chat.retry()) { setQuestion(''); setAttachment(undefined); } }
  function clear() { chat.clear(); setQuestion(''); setAttachment(undefined); }
  function download() {
    const text = chat.messages.map(message => `${message.role === 'user' ? 'You' : 'DrinksHarbour AI'}\n${message.content}`).join('\n\n');
    const url = URL.createObjectURL(new Blob([`DrinksHarbour ${label} planning conversation\nPlanning suggestions; confirm offers before ordering.\n\n${text}`], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'occasion-drinks-plan.txt'; link.click(); URL.revokeObjectURL(url);
  }
  const prompts = occasion === 'weddings' ? [
    ['Review my list', weddingAiTasks.review], ['Find drink ideas', weddingAiTasks.ideas], ['Non-alcoholic ideas', weddingAiTasks['non-alcoholic']],
  ] : [['Start my plan', `Help me plan drinks for my ${label}. Ask me what you need to know.`], ['I have a drinks list', 'I have a drinks list to discuss. Help me refine it.'], ['Non-alcoholic ideas', `Help me plan non-alcoholic choices for my ${label}.`]];
  if (!opened) return null;
  return <section id="occasion-ai-conversation" aria-labelledby={titleId} className="overflow-hidden rounded-3xl border border-rose-200 bg-white shadow-[0_12px_48px_-28px_rgba(53,16,20,0.35)]">
    <header className="flex items-start gap-3 border-b border-rose-100 px-5 py-6 sm:px-7"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#351014] text-[#e4c894]"><PiChatCircleDotsBold className="h-6 w-6" aria-hidden="true" /></div><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7c1d1d]">Let’s plan it together</p><h3 ref={heading} tabIndex={-1} id={titleId} className="mt-1 text-xl font-bold text-[#351014]">Your {label} AI planner</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">Tell me about your {label}, type the drinks you want, or attach your list. We’ll work through the choices together, one message at a time.</p></div></header>
    <div className="px-4 sm:px-6"><WeddingAiTranscript messages={chat.messages} loading={chat.loading} error={chat.error} onRetry={() => { void retry(); }} occasion={occasion} onChoose={onChoose ? choice => setSelectionNotice(onChoose(choice)) : undefined} />
      {selectionNotice && <p role="status" className="mt-3 text-sm leading-6 text-[#7c1d1d]">{selectionNotice}</p>}
      <div className="flex flex-wrap gap-2 py-4">{prompts.map(([text, prompt]) => <button key={text} type="button" onClick={() => { void quick(prompt); }} disabled={chat.loading || Boolean(listError)} className="min-h-11 rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold text-[#7c1d1d] hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d] disabled:opacity-50">{text}</button>)}{chat.messages.length > 0 && <button type="button" onClick={() => { void quick('Summarise our agreed plan, list the choices and quantities I supplied, and separate what is still undecided.'); }} disabled={chat.loading || Boolean(listError)} className="min-h-11 rounded-full border border-rose-200 px-4 text-xs font-semibold text-[#7c1d1d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d] disabled:opacity-50">Summarise our plan</button>}</div>
      {listError && <p role="status" className="mb-3 text-xs leading-6 text-red-700">Check your bottle list first: {listError}</p>}
      {direct && draftError && <p role="status" className="pb-3 text-xs leading-6 text-gray-500">Your unfinished bottle list is kept above and is not included in this chat. Upload a list or type what you need here.</p>}
      {items.length > 0 && !(direct && draftError) && <p className="pb-3 text-xs leading-6 text-gray-500">{items.length} selected {items.length === 1 ? 'bottle entry is' : 'bottle entries are'} included when you send. You can edit your list above.</p>}
    </div>
    <OccasionChatComposer question={question} setQuestion={setQuestion} attachment={attachment} setAttachment={setAttachment} loading={chat.loading} disabled={Boolean(listError)} onSend={() => { void send(); }} />
    <footer className="border-t border-rose-100 px-5 py-4 text-[11px] leading-6 text-gray-500"><div className="flex flex-wrap gap-x-5 gap-y-1"><button type="button" onClick={clear} className="min-h-10 font-semibold text-[#7c1d1d] underline">Clear AI conversation</button><button type="button" onClick={download} disabled={!chat.messages.length || chat.loading} className="min-h-10 font-semibold text-[#7c1d1d] underline disabled:opacity-40">Download conversation</button>{children}</div><p>AI suggestions are a working plan. Confirm sizes, prices, stock and delivery before ordering. Your list and cart change only when you edit them. This chat clears when you leave the page.</p></footer>
  </section>;
}

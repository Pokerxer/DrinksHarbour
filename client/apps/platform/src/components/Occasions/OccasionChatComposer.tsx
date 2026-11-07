'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { PiArrowUpBold, PiPaperclipBold, PiXBold } from 'react-icons/pi';
import { occasionFileAccept, validateOccasionAttachment } from '@/lib/occasionAttachment';

type Props = { question: string; setQuestion: (value: string) => void; attachment?: File; setAttachment: (file?: File) => void; loading: boolean; disabled: boolean; onSend: () => void };
export default function OccasionChatComposer({ question, setQuestion, attachment, setAttachment, loading, disabled, onSend }: Props) {
  const picker = useRef<HTMLInputElement>(null), area = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const el = area.current;
    if (!el || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, [question]);
  function submit(event: FormEvent) { event.preventDefault(); if (!loading && !disabled && (question.trim() || attachment)) onSend(); }
  return <form onSubmit={submit} className="border-t border-rose-100 bg-[#fcfaf8] p-4 sm:p-6">
    {attachment && <div className="mb-3 flex min-w-0 items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm"><PiPaperclipBold className="shrink-0 text-[#7c1d1d]" aria-hidden="true" /><span className="min-w-0 flex-1 break-all">{attachment.name}</span><button type="button" onClick={() => { setAttachment(undefined); setError(''); }} disabled={loading} aria-label="Remove attachment" className="grid min-h-11 min-w-11 place-items-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]"><PiXBold aria-hidden="true" /></button></div>}
    <label htmlFor="wedding-ai-question" className="sr-only">Ask your own question</label>
    <textarea ref={area} id="wedding-ai-question" value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} rows={3} maxLength={1000} disabled={loading} placeholder="Tell me what you’re planning, paste a drinks list, or ask a question…" className="max-h-80 min-h-28 w-full overflow-y-auto resize-none rounded-xl border border-rose-200 bg-white p-4 text-[16px] leading-7 text-gray-900 outline-offset-2 focus:outline-[#7c1d1d] disabled:opacity-60" />
    <input ref={picker} type="file" accept={occasionFileAccept} aria-label="Attach a drinks list or photo" className="sr-only" disabled={loading} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; const issue = validateOccasionAttachment(file); setError(issue || ''); if (!issue) setAttachment(file); }} />
    <div className="mt-3 flex items-center justify-between gap-3"><button type="button" onClick={() => picker.current?.click()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-[#7c1d1d] hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d] disabled:opacity-50"><PiPaperclipBold aria-hidden="true" />Attach list or photo</button><button type="submit" disabled={loading || disabled || (!question.trim() && !attachment)} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-[#7c1d1d] px-4 py-3 text-xs font-bold text-white hover:bg-[#571419] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d] disabled:opacity-50"><span>{loading ? 'Asking AI…' : 'Send to AI'}</span><PiArrowUpBold aria-hidden="true" /></button></div>
    <p className="mt-3 text-[11px] leading-5 text-gray-500">PDF, Word (.docx), Excel, CSV or text up to 8 MB. JPEG, PNG or WebP up to 5 MB. Enter to send; Shift + Enter for a new line.</p>
    <p className="mt-1 text-[11px] leading-5 text-gray-500">Messages and attachments are sent to our AI service when you press Send. Avoid including private guest or payment details.</p>
    {error && <p role="alert" className="mt-2 text-xs leading-6 text-red-700">{error}</p>}
  </form>;
}

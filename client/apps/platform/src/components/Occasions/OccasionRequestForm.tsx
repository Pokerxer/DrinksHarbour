'use client';
import { useEffect, useRef, useState, type FormEvent, type Ref } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { PiCheckCircleBold, PiArrowRightBold, PiClockBold } from 'react-icons/pi';
import { OCCASION_LABELS, nigeriaDate, prepareOccasionBrief, type OccasionId } from '@/lib/occasionBrief';
import { validateOccasionAttachment } from '@/lib/occasionAttachment';
import { submitOccasionRequest, type OccasionReceipt } from '@/lib/occasionRequest';
import { clearOccasionDraft, readOccasionDraft, writeOccasionDraft } from '@/lib/occasionDraft';
import type { BottleListItem } from '@/lib/weddingBottleList';
import type { DrinkCategoryPreference } from '@/lib/occasionGeneration';
import OccasionBriefAttachment from './OccasionBriefAttachment';
const empty = { name: '', channel: 'email' as 'email' | 'whatsapp', email: '', whatsapp: '', city: '', date: '', guests: '', budget: '', notes: '', consent: false };
// Only plan facts are persisted per occasion — never name/email/whatsapp/consent
// (see lib/occasionDraft.ts) and never the attachment File.
const recordable = (fields: typeof empty) => ({ channel: fields.channel, city: fields.city, date: fields.date, guests: fields.guests, budget: fields.budget, notes: fields.notes });
const recordedEmpty = JSON.stringify(recordable(empty));
const style = 'mt-2 min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 focus:border-[#7c1d1d] focus:outline-none focus:ring-2 focus:ring-[#7c1d1d]/15';
type Props = { occasion: OccasionId | ''; onOccasionChange?: (value: OccasionId | '') => void; fixedOccasion?: boolean; preferences: DrinkCategoryPreference[]; items: BottleListItem[]; detailsError?: string; onClear?: () => void; headingRef?: Ref<HTMLHeadingElement>; onReceipt?: (receipt: OccasionReceipt) => void; draftKey?: string };
export default function OccasionRequestForm({ occasion, onOccasionChange, fixedOccasion, preferences, items, detailsError, onClear, headingRef, onReceipt, draftKey }: Props) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [fields, setFields] = useState(empty), [file, setFile] = useState<File>();
  const [error, setError] = useState(''), [sending, setSending] = useState(false), [receipt, setReceipt] = useState<OccasionReceipt>();
  const [today, setToday] = useState(''), [invalidField, setInvalidField] = useState('');
  const [draftSaved, setDraftSaved] = useState(false);
  const draftOccasion = draftKey ?? (occasion || 'general');
  useEffect(() => { if (error && invalidField) document.getElementById(invalidField)?.focus(); }, [error, invalidField]);
  const fieldError = (id: string) => ({ 'aria-invalid': invalidField === id && Boolean(error) || undefined, 'aria-describedby': invalidField === id && error ? 'occasion-form-error' : undefined });
  const pending = useRef(false), submission = useRef({ signature: '', key: '' }), controller = useRef<AbortController | undefined>(undefined);
  useEffect(() => { setToday(nigeriaDate()); return () => controller.current?.abort(); }, []);
  // Draft restore per occasion page, incl. after the sign-in redirect back.
  // Contact details are re-asked: they are deliberately out of the saved draft.
  useEffect(() => {
    const draft = readOccasionDraft(draftOccasion);
    if (!draft) return;
    setDraftSaved(true);
    if (draft.fields) setFields(current => ({ ...current, ...draft.fields }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftOccasion]);
  useEffect(() => {
    const recordableFields = recordable(fields);
    const snapshot = JSON.stringify(recordableFields);
    if (snapshot === recordedEmpty) return;
    writeOccasionDraft(draftOccasion, { fields: recordableFields });
    setDraftSaved(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftOccasion, fields.channel, fields.city, fields.date, fields.guests, fields.budget, fields.notes]);
  function update<K extends keyof typeof empty>(field: K, value: typeof empty[K]) { setFields(current => ({ ...current, [field]: value })); setError(''); setInvalidField(''); }
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending.current) return;
    const brief = prepareOccasionBrief({ occasion, ...fields }, nigeriaDate());
    const contactValid = fields.channel === 'email' ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim()) : /^\+?[\d\s()-]{8,25}$/.test(fields.whatsapp.trim());
    const issue = !brief.ok ? Object.values(brief.errors)[0] : detailsError || validateOccasionAttachment(file) || (fields.name.trim().length < 2 ? 'Enter your name.' : !contactValid ? `Enter a valid ${fields.channel === 'email' ? 'email address' : 'WhatsApp number'}.` : !fields.consent ? 'Allow our team to reply to this request.' : !items.length && !preferences.length && !fields.notes.trim() && !file ? 'Describe what you need, choose drinks or attach your list.' : '');
    if (issue) {
      const briefField = !brief.ok ? Object.keys(brief.errors)[0] : '';
      const target = briefField ? `occasion-${briefField === 'occasion' ? 'choice' : briefField}` : detailsError ? '' : validateOccasionAttachment(file) ? 'occasion-list-file' : fields.name.trim().length < 2 ? 'occasion-name' : !contactValid ? `occasion-${fields.channel === 'email' ? 'email' : 'whatsapp'}` : !fields.consent ? 'occasion-consent' : 'occasion-notes';
      setInvalidField(target); setError(issue); return;
    }
    const selected = items.map(item => ({ productId: item.productId || '', name: item.name, quantity: Number(item.quantity) }));
    const signature = JSON.stringify({ occasion, fields, preferences, selected, file: file ? [file.name, file.size, file.lastModified] : null });
    if (submission.current.signature !== signature) submission.current = { signature, key: crypto.randomUUID() };
    pending.current = true; setSending(true); setError('');
    const active = new AbortController(); controller.current = active;
    const timer = setTimeout(() => active.abort(), 20000);
    try { const saved = await submitOccasionRequest({ submissionKey: submission.current.key, occasion, ...fields, preferences, items: selected }, file, active.signal); setReceipt(saved); onReceipt?.(saved); }
    catch (failure) { setError(active.signal.aborted ? 'We could not confirm receipt in time. Retry with the same details; your request will not be duplicated.' : failure instanceof Error ? failure.message : 'We could not confirm receipt. Please retry.'); }
    finally { clearTimeout(timer); pending.current = false; setSending(false); }
  }
  function clear() { setFields(empty); setFile(undefined); setReceipt(undefined); setError(''); setInvalidField(''); submission.current = { signature: '', key: '' }; setDraftSaved(false); clearOccasionDraft(draftOccasion); onClear?.(); }
  return <section id="occasion-planner" className="scroll-mt-28 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm" aria-labelledby="occasion-planner-heading">
    <div className="border-b border-gray-100 p-6"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7c1d1d]">A plan from our team</p><h2 id="occasion-planner-heading" ref={headingRef} tabIndex={-1} className="mt-3 text-2xl font-bold text-gray-950">Send us your {occasion === 'weddings' ? 'wedding' : 'occasion'} brief.</h2><p className="mt-3 text-sm leading-7 text-gray-600">Share your list or tell us what you need. Our team will check available drinks and prepare a plan for your guests and budget.</p><p className="mt-4 flex items-start gap-2 rounded-xl bg-[#163a30] p-4 text-sm leading-6 text-white"><PiClockBold className="mt-1 shrink-0" aria-hidden="true" />We aim to reply in about 30 minutes. You can leave this page—we’ll contact you by email or WhatsApp. Busy periods may take longer.</p>{draftSaved && <p className="mt-3 text-xs leading-5 text-gray-500">Draft saved on this device — it stays here for this occasion page. Your attachment is never saved; re-add it before sending.</p>}</div>
    {!isAuthenticated || user?.role !== 'customer' ? <div className="space-y-4 p-6"><h3 className="text-xl font-bold">Keep your plan and conversation together.</h3><p className="text-sm leading-7 text-gray-600">Sign in to send your request. Your list and replies from our team will be saved under Chat in your profile, so you can return and continue the conversation.</p><Link href={`/login?redirect=${encodeURIComponent(occasion ? `/occasions/${occasion}` : '/occasions')}`} className="inline-flex min-h-12 items-center rounded-full bg-[#7c1d1d] px-6 py-3 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]">{isLoading ? 'Checking your account…' : 'Sign in to send your request'}</Link></div> : receipt ? <div role="status" className="space-y-4 p-6"><PiCheckCircleBold aria-hidden="true" className="h-9 w-9 text-[#163a30]" /><h3 className="text-xl font-bold">Your request is with our team.</h3><p className="text-sm leading-7 text-gray-600">Reference: <strong className="select-all">{receipt.reference}</strong></p><p className="text-sm leading-7 text-gray-600">We’ll send your reviewed plan to {receipt.channel === 'email' ? fields.email : fields.whatsapp}. You don’t need to stay on the site. You can also find this conversation under Chat in your profile. Our response target is about 30 minutes; it may take longer during busy periods.</p><p className="text-xs leading-6 text-gray-500">This is a request for a plan. No stock is reserved and no order has been placed.</p><Link className="inline-flex min-h-11 items-center rounded-full bg-[#163a30] px-5 py-3 text-sm font-semibold text-white" href={`/my-account/chat/${receipt.conversationId}`}>Open your saved conversation</Link><button type="button" onClick={clear} className="mt-3 block min-h-11 font-semibold sm:ml-4 sm:mt-0 sm:inline-block text-[#7c1d1d] underline">Send another request</button></div> : <form onSubmit={send} noValidate className="p-6">
      <fieldset disabled={sending} className="space-y-5">
        {!fixedOccasion ? <label className="block text-sm font-semibold" htmlFor="occasion-choice">Your occasion *<select id="occasion-choice" {...fieldError('occasion-choice')} className={style} value={occasion} onChange={event => onOccasionChange?.(event.target.value as OccasionId | '')}><option value="">Choose an occasion</option>{Object.entries(OCCASION_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label> : <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-[#7c1d1d]">{OCCASION_LABELS[occasion as OccasionId]}</p>}
        <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold" htmlFor="occasion-city">Delivery city *<input id="occasion-city" {...fieldError('occasion-city')} autoComplete="address-level2" required className={style} value={fields.city} maxLength={80} onChange={event => update('city', event.target.value)} placeholder="e.g. Abuja" /></label><label className="block text-sm font-semibold" htmlFor="occasion-date">Event date<input id="occasion-date" {...fieldError('occasion-date')} type="date" min={today || undefined} className={style} value={fields.date} onChange={event => update('date', event.target.value)} /></label></div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold" htmlFor="occasion-guests">Number of guests<input id="occasion-guests" {...fieldError('occasion-guests')} type="number" min={1} max={100000} step={1} className={style} value={fields.guests} onChange={event => update('guests', event.target.value)} placeholder="e.g. 300" /></label><label className="block text-sm font-semibold" htmlFor="occasion-budget">Drinks budget (₦)<input id="occasion-budget" {...fieldError('occasion-budget')} inputMode="decimal" className={style} value={fields.budget} onChange={event => update('budget', event.target.value)} placeholder="e.g. 5000000" /></label></div>
        <label className="block text-sm font-semibold" htmlFor="occasion-notes">Your list or requirements<textarea id="occasion-notes" {...fieldError('occasion-notes')} rows={4} maxLength={500} className={style} value={fields.notes} onChange={event => update('notes', event.target.value)} placeholder="Paste your drinks list, or tell us about guest tastes, reception length, non-alcoholic choices and what the venue provides…" /></label>
        <OccasionBriefAttachment file={file} onChange={setFile} disabled={sending} />
        <div className="border-t border-gray-100 pt-5"><h3 className="font-bold">Where should we send your plan?</h3><label htmlFor="occasion-name" className="mt-4 block text-sm font-semibold">Your name *<input id="occasion-name" {...fieldError('occasion-name')} autoComplete="name" maxLength={80} required className={style} value={fields.name} onChange={event => update('name', event.target.value)} /></label><label htmlFor="occasion-channel" className="mt-4 block text-sm font-semibold">Reply by *<select id="occasion-channel" {...fieldError('occasion-channel')} value={fields.channel} onChange={event => update('channel', event.target.value as 'email' | 'whatsapp')} className={style}><option value="email">Email</option><option value="whatsapp">WhatsApp</option></select></label>
          {fields.channel === 'email' ? <label htmlFor="occasion-email" className="mt-4 block text-sm font-semibold">Email address *<input id="occasion-email" {...fieldError('occasion-email')} type="email" autoComplete="email" maxLength={254} required className={style} value={fields.email} onChange={event => update('email', event.target.value)} /></label> : <label htmlFor="occasion-whatsapp" className="mt-4 block text-sm font-semibold">WhatsApp number *<input id="occasion-whatsapp" {...fieldError('occasion-whatsapp')} type="tel" autoComplete="tel" maxLength={25} placeholder="e.g. +234 801 234 5678" required className={style} value={fields.whatsapp} onChange={event => update('whatsapp', event.target.value)} /></label>}
        </div>
        <label className="flex cursor-pointer items-start gap-3 text-xs leading-6 text-gray-600"><input id="occasion-consent" {...fieldError('occasion-consent')} type="checkbox" checked={fields.consent} onChange={event => update('consent', event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#7c1d1d]" />Our team may contact me using these details to review and reply to this request.</label>
        {error && <p id="occasion-form-error" role="alert" className="rounded-lg bg-red-50 p-3 text-sm leading-6 text-red-800">{error}</p>}
        <button type="submit" disabled={Boolean(detailsError) || sending} className="flex min-h-12 w-full items-center justify-center gap-3 rounded-full bg-[#7c1d1d] px-5 py-3 text-sm font-bold text-white hover:bg-[#571419] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d] disabled:opacity-50">{sending ? 'Sending your request…' : 'Send request to our team'}<PiArrowRightBold aria-hidden="true" /></button>
        {detailsError && <p role="alert" className="text-sm text-red-700">{detailsError}</p>}<p className="text-[11px] leading-6 text-gray-500">Your selected bottles, preferences, event details and attachment will be shared with our planning team. Avoid private guest or payment details. Prices, stock and delivery will be confirmed before you order.</p><button type="button" onClick={clear} className="min-h-11 text-sm text-gray-600 underline">Clear brief</button>
      </fieldset>
    </form>}
    <noscript><p className="p-6 text-sm">This form needs JavaScript. Please <a className="underline" href="/contact">contact our team</a> to share your list.</p></noscript>
  </section>;
}

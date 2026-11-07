'use client';

import { useEffect, useState, type FormEvent, type ReactNode, type Ref } from 'react';
import Link from 'next/link';
import { PiNotePencilBold, PiArrowRightBold, PiCheckCircleBold, PiCaretDownBold } from 'react-icons/pi';
import { OCCASION_LABELS, nigeriaDate, prepareOccasionBrief, type OccasionId, type OccasionBriefInput, type PreparedBrief, type BriefErrors } from '@/lib/occasionBrief';
import type { DrinkCategoryPreference, OccasionGeneration } from '@/lib/occasionGeneration';
import { prepareOccasionAiBrief } from '@/lib/occasionAiBrief';
import OccasionBriefAttachment from './OccasionBriefAttachment';
import EnquiryLink from '@/components/CommerceGuides/EnquiryLink';

const emptyFields = { city: '', date: '', guests: '', budget: '', notes: '' };
const fieldClass = 'mt-2 w-full min-h-11 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-[16px] sm:text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#7c1d1d] focus:outline-none focus:ring-2 focus:ring-[#7c1d1d]/15';

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return <div><label htmlFor={id} className="text-xs font-semibold text-gray-800">{label}</label>{children}{error && <p id={`${id}-error`} className="mt-1.5 text-xs leading-5 text-red-700">{error}</p>}</div>;
}

export default function OccasionPlanner({ occasion, onOccasionChange, headingRef, fixedOccasion = false, details = '', detailsError, title = 'Let’s build your brief.', onClear, onSendToAi, sendingToAi = false, preferences = [] }: {
  occasion: OccasionId | '';
  onOccasionChange?: (occasion: OccasionId | '') => void;
  headingRef: Ref<HTMLHeadingElement>;
  fixedOccasion?: boolean;
  details?: string;
  detailsError?: string;
  title?: string;
  onClear?: () => void;
  preferences?: DrinkCategoryPreference[];
  onSendToAi?: (context: string, attachment?: File, generation?: OccasionGeneration) => void;
  sendingToAi?: boolean;
}) {
  const [attachment, setAttachment] = useState<File>();
  const [fields, setFields] = useState(emptyFields);
  const [errors, setErrors] = useState<BriefErrors>({});
  const [prepared, setPrepared] = useState<Extract<PreparedBrief, { ok: true }> | null>(null);
  const [today, setToday] = useState('');
  useEffect(() => { setToday(nigeriaDate()); }, []);
  useEffect(() => { setPrepared(null); setErrors({}); }, [occasion, details, detailsError]);

  function update(field: keyof typeof fields, value: string) {
    setFields(current => ({ ...current, [field]: value }));
    setPrepared(null);
    setErrors(current => { const next = { ...current }; delete next[field]; return next; });
  }
  function accessibility(field: keyof OccasionBriefInput) {
    return { 'aria-invalid': errors[field] ? true : undefined, 'aria-describedby': errors[field] ? `occasion-${field === 'occasion' ? 'choice' : field}-error` : undefined };
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (detailsError) { setPrepared(null); return; }
    const intent = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value');
    const ai = intent === 'ai' && onSendToAi;
    const input = { occasion, ...fields };
    const result = ai ? prepareOccasionAiBrief(input, nigeriaDate(), preferences.length > 0) : prepareOccasionBrief(input, nigeriaDate());
    if (!result.ok) {
      setPrepared(null); setErrors(result.errors);
      const first = Object.keys(result.errors)[0];
      document.getElementById(first === 'occasion' ? 'occasion-choice' : `occasion-${first}`)?.focus();
      return;
    }
    if ('context' in result) { setErrors({}); setPrepared(null); onSendToAi?.(result.context, attachment, preferences.length ? { categories: preferences, budget: Number(fields.budget), guests: Number(fields.guests) } : undefined); return; }
    setErrors({}); setPrepared({ ...result, message: details ? `${result.message}\nDrinks to explore: ${details}` : result.message });
  }
  function clear() {
    setAttachment(undefined); setFields(emptyFields); setPrepared(null); setErrors({});
    if (!fixedOccasion) onOccasionChange?.('');
    onClear?.();
  }
  const phone = process.env.NEXT_PUBLIC_WHATSAPP_PHONE || '2347048004020';

  return <section id="occasion-planner" className="scroll-mt-28 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_8px_40px_-20px_rgba(53,16,20,0.22)]" aria-labelledby="occasion-planner-heading">
    <div className="border-b border-gray-100 px-6 pb-5 pt-6">
      <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#7c1d1d]"><PiNotePencilBold className="h-4 w-4" aria-hidden="true" />Your occasion, on paper</div>
      <h2 id="occasion-planner-heading" ref={headingRef} tabIndex={-1} className="scroll-mt-32 text-2xl font-bold tracking-tight text-gray-950 focus:outline-none">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-gray-600">{onSendToAi ? 'Choose your bottles and share the details you know. Send them to the AI planner when you’re ready, then continue the conversation below.' : 'Tell us a little about the plan. We’ll turn it into a message you can review and send to our team.'}</p>
    </div>
    <form onSubmit={submit} action="/contact" method="get" noValidate className="space-y-4 px-6 py-5">
      <p className="text-[11px] leading-5 text-gray-500">{onSendToAi ? 'Choose an occasion. Select categories to generate a list using your budget and guest count, or send your chosen bottles for review.' : fixedOccasion ? 'Delivery city is required. Other details are optional.' : 'Occasion and city are required. Everything else is optional.'}</p>
      {fixedOccasion && occasion ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-[#7c1d1d]">Occasion: {OCCASION_LABELS[occasion]}</p> : <Field id="occasion-choice" label="Your occasion *" error={errors.occasion}>
        <div className="relative"><select id="occasion-choice" value={occasion} onChange={event => onOccasionChange?.(event.target.value as OccasionId | '')} required className={`${fieldClass} pr-10`} {...accessibility('occasion')}>
          <option value="">Choose an occasion</option>{Object.entries(OCCASION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select><PiCaretDownBold aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" /></div>
      </Field>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="occasion-city" label={onSendToAi ? 'Delivery city' : 'Delivery city *'} error={errors.city}><input id="occasion-city" autoComplete="address-level2" value={fields.city} onChange={event => update('city', event.target.value)} maxLength={80} placeholder="e.g. Abuja" required={!onSendToAi} className={fieldClass} {...accessibility('city')} /></Field>
        <Field id="occasion-date" label="Preferred date" error={errors.date}><input id="occasion-date" type="date" min={today || undefined} value={fields.date} onChange={event => update('date', event.target.value)} className={`${fieldClass} min-w-0`} {...accessibility('date')} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field id="occasion-guests" label={preferences.length ? 'Number of guests *' : 'Number of guests'} error={errors.guests}><input id="occasion-guests" type="number" inputMode="numeric" min={1} step={1} value={fields.guests} onChange={event => update('guests', event.target.value)} placeholder="e.g. 40" className={fieldClass} {...accessibility('guests')} /></Field>
        <Field id="occasion-budget" label={preferences.length ? 'Total drinks budget (₦) *' : 'Total drinks budget (₦)'} error={errors.budget}><input id="occasion-budget" type="text" inputMode="decimal" value={fields.budget} onChange={event => update('budget', event.target.value)} placeholder="e.g. 150000" className={fieldClass} {...accessibility('budget')} /></Field>
      </div>
      <Field id="occasion-notes" label="Anything else we should know?" error={errors.notes}><textarea id="occasion-notes" value={fields.notes} onChange={event => update('notes', event.target.value)} rows={2} maxLength={500} placeholder="Favourite bottles, non-alcoholic choices, packaging…" className={`${fieldClass} resize-y`} {...accessibility('notes')} /></Field>
      {Object.keys(errors).length > 0 && <p role="alert" className="text-xs font-medium text-red-700">Check the highlighted fields before continuing.</p>}
      {detailsError && <p role="alert" className="text-xs leading-6 text-red-700">Check your bottle list: {detailsError}</p>}
      {onSendToAi && <><OccasionBriefAttachment file={attachment} onChange={setAttachment} disabled={sendingToAi} /><button type="submit" name="intent" value="ai" disabled={Boolean(detailsError) || sendingToAi} className="flex min-h-12 w-full items-center justify-center gap-3 rounded-full bg-[#7c1d1d] px-5 py-3 text-sm font-bold text-white hover:bg-[#571419] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d] disabled:opacity-50">{sendingToAi ? 'Planning with AI…' : preferences.length ? 'Generate my drinks list' : 'Send list to AI'}<PiArrowRightBold aria-hidden="true" /></button><p className="text-[11px] leading-5 text-gray-500">Sends your bottle list, preferences, event details and attached file to our AI service. The conversation opens below. Avoid private guest or payment details.</p></>}
      <button type="submit" name="intent" value="enquiry" disabled={Boolean(detailsError)} className={`flex min-h-12 w-full items-center justify-center gap-3 rounded-full px-5 py-3 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d] disabled:opacity-50 ${onSendToAi ? 'border border-rose-200 text-[#7c1d1d] hover:bg-rose-50' : 'bg-[#7c1d1d] text-white hover:bg-[#571419]'}`}>Prepare my enquiry <PiArrowRightBold aria-hidden="true" /></button>
      <div className="flex items-center justify-between gap-4 text-xs"><Link href="/contact" className="font-semibold text-gray-600 underline underline-offset-4">Use our contact form</Link><button type="button" onClick={clear} className="min-h-9 px-1 text-gray-500 underline underline-offset-4 hover:text-gray-900">Clear brief</button></div>
      <p className="text-[11px] leading-5 text-gray-500">{onSendToAi ? 'Prepare my enquiry creates a WhatsApp draft for you to review and send separately. Send list to AI starts the planning conversation. Stock, packaging and delivery need confirmation.' : 'Preparing this brief sends nothing. You choose whether to open and send a WhatsApp message. Stock, packaging and delivery need confirmation.'}</p>
      <noscript><p className="text-sm leading-6">The brief builder needs JavaScript. You can still read every occasion guide or <Link href="/contact" className="underline">use the contact form</Link>.</p></noscript>
    </form>
    {prepared && <div role="status" aria-live="polite" className="border-t border-emerald-100 bg-emerald-50 px-6 py-6">
      <h3 className="flex items-center gap-2 text-sm font-bold text-[#163a30]"><PiCheckCircleBold className="h-5 w-5" aria-hidden="true" />Your draft is ready</h3>
      <p className="mt-2 text-xs leading-5 text-emerald-900">Review it below. WhatsApp will open with this draft; send it there when you are ready.</p>
      <pre className="mt-4 select-text whitespace-pre-wrap break-words rounded-xl border border-emerald-100 bg-white p-4 font-sans text-xs leading-6 text-gray-700">{prepared.message}</pre>
      <EnquiryLink type={prepared.occasion} label="Open WhatsApp draft" href={`https://wa.me/${phone}?text=${encodeURIComponent(prepared.message)}`} />
    </div>}
  </section>;
}

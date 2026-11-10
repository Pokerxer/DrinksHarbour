'use client';
import { enterSubmitsMessage } from '@/lib/chatKeyboard';

type Props = {
  /** Stable id of the textarea (tests and labels rely on it). */
  id: string;
  label: string;
  /** sr-friendly hint text shown under the field, e.g. the length policy. */
  hint: string;
  hintId: string;
  buttonLabel: string;
  sendingLabel: string;
  sending: boolean;
  value: string;
  onSend: () => void;
  onChange: (value: string) => void;
};

/** Shared WhatsApp-style composer for the customer chat surfaces. The control
 * is words only (no price/size/pack controls). Enter submits on a real desktop
 * keyboard (never during IME composition, never for touch/virtual keyboards),
 * Shift+Enter inserts a newline, and the Send button always works everywhere.
 * 16px field text on mobile, 44px minimum button target. */
export default function ChatComposer({ id, label, hint, hintId, buttonLabel, sendingLabel, sending, value, onSend, onChange }: Props) {
  return <form className="border-t border-[#7c1d1d]/10 bg-white p-4" onSubmit={event => { event.preventDefault(); onSend(); }} aria-busy={sending}>
    <label htmlFor={id} className="text-sm font-semibold text-gray-700">{label}</label>
    <textarea id={id} rows={3} maxLength={4000} value={value} disabled={sending}
      onChange={event => onChange(event.target.value)}
      onKeyDown={event => { if (!enterSubmitsMessage(event.nativeEvent)) return; event.preventDefault(); if (!sending) onSend(); }}
      className="mt-2 w-full rounded-xl border border-gray-300 bg-white p-3 text-base text-gray-900 focus:border-[#7c1d1d] focus:outline-none focus:ring-2 focus:ring-[#7c1d1d]/20 disabled:opacity-60" />
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <p id={hintId} className="text-xs leading-6 text-gray-500">{value.length}/4,000 · {hint}</p>
      <button type="submit" disabled={sending || !value.trim()}
        className="inline-flex min-h-11 items-center rounded-full bg-[#7c1d1d] px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-[#571419] motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d] disabled:opacity-50">
        {sending ? sendingLabel : buttonLabel}
      </button>
    </div>
  </form>;
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { GIFT_OCCASIONS, GIFT_RELATIONSHIPS, giftMessages, type GiftOccasion, type GiftRelationship } from './giftMessages';
import styles from './giftAnimations.module.css';

const SELECT_CLASS = 'mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]';

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const dots = (delay: (index: number) => string) => [0, 1, 2].map(index => <span key={index} className={styles.dot} style={{ animationDelay: delay(index) }}>.</span>);

/**
 * Gift message helper: fixed phrasing templates by relationship × occasion with
 * a short "writing" shimmer before results appear. Copy-to-clipboard only —
 * nothing is sent anywhere by this control.
 */
export default function GiftMessageCard() {
  const [relationship, setRelationship] = useState<GiftRelationship>('friend');
  const [occasion, setOccasion] = useState<GiftOccasion>('birthday');
  const [name, setName] = useState('');
  const [writing, setWriting] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function pick(next: { relationship?: GiftRelationship; occasion?: GiftOccasion; name?: string }) {
    if (next.relationship !== undefined) setRelationship(next.relationship);
    if (next.occasion !== undefined) setOccasion(next.occasion);
    if (next.name !== undefined) setName(next.name);
    if (prefersReducedMotion()) { setWriting(false); return; }
    setWriting(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setWriting(false), 600);
  }

  async function copy(text: string, index: number) {
    try { await navigator.clipboard.writeText(text); setCopied(index); setTimeout(() => setCopied(current => (current === index ? null : current)), 2500); } catch { setCopied(null); }
  }

  const messages = writing ? [] : giftMessages(relationship, occasion, name).map((text, index) => ({ text, index }));

  return <section className="rounded-2xl border border-gray-200 bg-white p-6" aria-label="Gift message helper">
    <h3 className="text-xl font-bold text-gray-900">A few words with the bottle</h3>
    <p className="mt-2 text-sm leading-6 text-gray-600">Pick the relationship and the occasion for a starting line you can personalise. Copy the one you like — wording is yours to edit, and a card is only included once the team confirms it in writing.</p>
    <div className="mt-4 grid gap-4 sm:grid-cols-3">
      <label className="block text-sm font-semibold text-gray-700">Relationship
        <select value={relationship} onChange={event => pick({ relationship: event.target.value as GiftRelationship })} className={SELECT_CLASS}>
          {GIFT_RELATIONSHIPS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label className="block text-sm font-semibold text-gray-700">Occasion
        <select value={occasion} onChange={event => pick({ occasion: event.target.value as GiftOccasion })} className={SELECT_CLASS}>
          {GIFT_OCCASIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label className="block text-sm font-semibold text-gray-700">Recipient name (optional)
        <input value={name} onChange={event => pick({ name: event.target.value })} maxLength={40} placeholder="e.g. Ada" className={`block w-full ${SELECT_CLASS}`} />
      </label>
    </div>
    <div aria-live="polite" className="mt-4 space-y-2">
      {writing && <p className="flex items-center gap-1 text-sm font-semibold text-[#7c1d1d]">Writing suggestions{dots(i => `${i * 0.16}s`)}</p>}
      {!writing && messages.map(({ text, index }) => <div key={text} className="dropIn flex items-start justify-between gap-3 rounded-xl border border-gray-100 p-3" style={{ animationDelay: `${index * 70}ms` }}>
        <p className="min-w-0 text-sm leading-6 text-gray-700">“{text}”</p>
        <button type="button" onClick={() => void copy(text, index)} className="inline-flex min-h-9 shrink-0 items-center rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-[#7c1d1d] hover:border-[#7c1d1d]"
          aria-label={`Copy suggestion ${index + 1}`}>{copied === index ? 'Copied' : 'Copy'}</button>
      </div>)}
      {!writing && !messages.length && <p className="text-sm text-gray-600">No message suggestions yet — choose a relationship and occasion above.</p>}
    </div>
    <p className="mt-3 text-xs leading-5 text-gray-500">Fixed starting lines only — nothing personal is stored or sent. Message cards, wrapping and hand-over timing are confirmed with the team.</p>
  </section>;
}

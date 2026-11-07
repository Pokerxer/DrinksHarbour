'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { PiArrowUpRightBold } from 'react-icons/pi';
import WeddingBottleList from './WeddingBottleList';
import WeddingDrinkInterests from './WeddingDrinkInterests';
import WeddingQuantities from './WeddingQuantities';
import { addBottle, validateBottleList, type BottleChoice, type BottleListItem } from '@/lib/weddingBottleList';
import OccasionRequestForm from '@/components/Occasions/OccasionRequestForm';
import OccasionCtaBand from '@/components/Occasions/planning/OccasionCtaBand';
import PostSendChat from '@/components/Occasions/chat/PostSendChat';
import type { OccasionReceipt } from '@/lib/occasionRequest';
import { readOccasionDraft, writeOccasionDraft, type OccasionDraftItem } from '@/lib/occasionDraft';
import { type WeddingDrinkId } from './data';

const DRAFT_KEY = 'weddings';

/**
 * Wedding planner: bottle list + request form in one section, quantities
 * below. Category preferences and list entries restore from — and persist
 * to — the weddings device draft (lib/occasionDraft.ts); the form handles its
 * own text fields under the same key. A successful send mounts the shared
 * post-send chat pane, exactly as OccasionChatPlanner does on the other three
 * occasion pages.
 */
export default function WeddingPlanner() {
  const [selected, setSelected] = useState<WeddingDrinkId[]>([]);
  const [items, setItems] = useState<BottleListItem[]>([]);
  const [reset, setReset] = useState(0);
  const [receipt, setReceipt] = useState<OccasionReceipt>();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const listError = validateBottleList(items);
  function clear() { setSelected([]); setItems([]); setReset(current => current + 1); }
  useEffect(() => {
    const draft = readOccasionDraft(DRAFT_KEY);
    if (draft?.preferences) setSelected(draft.preferences as WeddingDrinkId[]);
    if (draft?.items) setItems(draft.items as BottleListItem[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (selected.length) writeOccasionDraft(DRAFT_KEY, { preferences: selected });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  useEffect(() => {
    if (items.length) writeOccasionDraft(DRAFT_KEY, { items: items as OccasionDraftItem[] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);
  function applyChoices(choices: BottleChoice[]): string | undefined {
    let next = items, firstError: string | undefined;
    for (const choice of choices) {
      const result = addBottle(next, choice);
      if (result.error) { firstError = firstError || result.error; break; }
      next = result.items;
    }
    setItems(next);
    return firstError;
  }
  function toggle(id: WeddingDrinkId) {
    setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  }
  return <section id="wedding-list" className="mx-auto max-w-7xl scroll-mt-28 px-5 py-12 sm:px-8 lg:py-16" aria-labelledby="wedding-list-heading">
    <div className="mb-8 max-w-2xl"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7c1d1d]">Start with your people</p><h2 id="wedding-list-heading" className="mt-3 text-3xl font-bold tracking-tight text-gray-950">Let’s plan your wedding drinks together.</h2><p className="mt-3 leading-7 text-gray-600">Choose drinks or upload your list, then share your guest count and budget. Our team will check availability and send a reviewed plan by email or WhatsApp.</p></div>
    <div className="grid items-start gap-8 xl:grid-cols-[1.15fr_1fr] xl:gap-10">
      <div>
        <WeddingDrinkInterests selected={selected} toggle={toggle} />
        <div className="mt-6"><WeddingBottleList key={reset} items={items} onChange={setItems} /></div>
        <div className="mt-6 rounded-xl bg-[#163a30] p-6 text-white"><h3 className="text-lg font-bold">A guest count is a starting point.</h3><p className="mt-2 text-sm leading-7 text-white/80">Your reception length, guest preferences and serving style matter too. Share those details in your note rather than relying on a fixed bottles-per-guest estimate.</p><Link href="/bulk-drinks" className="mt-3 inline-flex min-h-10 items-center gap-2 text-xs font-semibold underline underline-offset-4">Read the bulk buying guide<PiArrowUpRightBold aria-hidden="true" /></Link></div>
      </div>
      <div className="xl:sticky xl:top-28"><OccasionRequestForm occasion="weddings" fixedOccasion headingRef={headingRef} items={items} preferences={selected} detailsError={listError} onClear={clear} onReceipt={setReceipt} draftKey={DRAFT_KEY} />{receipt && <PostSendChat key={receipt.conversationId} reference={receipt.reference} conversationId={receipt.conversationId} />}</div>
    </div>
    <div className="mt-10"><WeddingQuantities applyChoices={applyChoices} selected={selected} /></div>
    <div className="mt-10"><OccasionCtaBand heading="List looks right?" note="Send it from the request form above with your date, city and budget — a human replies by email or WhatsApp. No stock reserved, no order placed." /></div>
  </section>;
}

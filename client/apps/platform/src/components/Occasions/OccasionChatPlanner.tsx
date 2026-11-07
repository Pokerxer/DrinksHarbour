'use client';

import { useEffect, useRef, useState, type Ref } from 'react';
import OccasionRequestForm from './OccasionRequestForm';
import PostSendChat from './chat/PostSendChat';
import type { OccasionReceipt } from '@/lib/occasionRequest';
import { readOccasionDraft, writeOccasionDraft, type OccasionDraftItem } from '@/lib/occasionDraft';
import type { DrinkCategoryPreference } from '@/lib/occasionGeneration';
import WeddingDrinkInterests from '@/components/Weddings/WeddingDrinkInterests';
import { type WeddingDrinkId } from '@/components/Weddings/data';
import WeddingBottleList from '@/components/Weddings/WeddingBottleList';
import { validateBottleList, type BottleListItem } from '@/lib/weddingBottleList';
import { OCCASION_LABELS, type OccasionId } from '@/lib/occasionBrief';
import { useOptionalOccasionDrinks } from './planning/OccasionDrinksContext';

type Props = { occasion?: string; onOccasionChange?: (occasion: OccasionId | '') => void; headingRef?: Ref<HTMLHeadingElement>; embedded?: boolean };
export default function OccasionChatPlanner({ occasion = 'general', onOccasionChange, headingRef, embedded = false }: Props) {
  const [drinksSelected, setDrinksSelected] = useState<WeddingDrinkId[]>([]);
  const drinks = useOptionalOccasionDrinks();
  const preferences = drinks ? drinks.selected : drinksSelected;
  const toggle = drinks ? drinks.toggle : (id: WeddingDrinkId) => setDrinksSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const [items, setItems] = useState<BottleListItem[]>([]), [reset, setReset] = useState(0);
  const [localOccasion, setLocalOccasion] = useState<OccasionId | ''>(occasion in OCCASION_LABELS ? occasion as OccasionId : '');
  const [receipt, setReceipt] = useState<OccasionReceipt>();
  const selected = onOccasionChange ? (occasion in OCCASION_LABELS ? occasion as OccasionId : '') : localOccasion;
  const ownHeading = useRef<HTMLHeadingElement>(null);
  // One draft key per occasion page ('general' on the hub): category
  // preferences, quantity entries and — where this component owns the picker —
  // the occasion choice. Own-state only: provider pages persist through
  // OccasionDrinksProvider. Contact fields live only in the request form and
  // never reach the draft (lib/occasionDraft.ts).
  const draftKey = occasion;
  useEffect(() => {
    const draft = readOccasionDraft(draftKey);
    if (!draft) return;
    if (!onOccasionChange && draft.occasion && draft.occasion in OCCASION_LABELS) setLocalOccasion(draft.occasion as OccasionId);
    if (!drinks && draft.preferences) setDrinksSelected(draft.preferences as WeddingDrinkId[]);
    if (draft.items) setItems(draft.items as BottleListItem[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!drinks && preferences.length) writeOccasionDraft(draftKey, { preferences: preferences as DrinkCategoryPreference[] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences, drinks, draftKey]);
  useEffect(() => {
    if (items.length) writeOccasionDraft(draftKey, { items: items as OccasionDraftItem[] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, draftKey]);
  useEffect(() => {
    if (!onOccasionChange && localOccasion) writeOccasionDraft(draftKey, { occasion: localOccasion });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localOccasion, onOccasionChange, draftKey]);
  function clear() { if (!drinks) setDrinksSelected([]); setItems([]); setReset(count => count + 1); }
  return <section id="occasion-chat" className={embedded ? 'mt-10 scroll-mt-28' : 'mx-auto max-w-7xl scroll-mt-28 px-5 py-12 sm:px-8'}>
    <div className="mb-7 max-w-2xl"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7c1d1d]">Your plan starts here</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-[#351014]">Your occasion. A plan from our team.</h2><p className="mt-3 leading-7 text-gray-600">Build a list or attach one, add your event details, then send your requirements. Our team will check available drinks and reply by email or WhatsApp.</p></div>
    <div className="grid items-start gap-8 xl:grid-cols-2"><div><WeddingDrinkInterests selected={preferences} toggle={toggle} /><div className="mt-6"><WeddingBottleList key={reset} items={items} onChange={setItems} listLabel="occasion" /></div></div><OccasionRequestForm occasion={selected} onOccasionChange={onOccasionChange || setLocalOccasion} headingRef={headingRef || ownHeading} fixedOccasion={!onOccasionChange && occasion !== 'general'} items={items} preferences={preferences} detailsError={validateBottleList(items)} onClear={clear} onReceipt={setReceipt} draftKey={draftKey} /></div>
    {receipt && <PostSendChat key={receipt.conversationId} reference={receipt.reference} conversationId={receipt.conversationId} />}
  </section>;
}

'use client';

import { useState, type Ref } from 'react';
import { requestPlanningDraft } from '@/lib/chatPlanning';
import { buildWeddingChatPrompt } from '@/lib/weddingChatPrompt';
import type { BottleListItem, BottleChoice } from '@/lib/weddingBottleList';
import OccasionChat, { type OccasionChatHandle } from '@/components/Occasions/OccasionChat';

export default function WeddingChatHelp({ items, interests, onChoose, chatRef, deferred, onBusyChange }: { items: BottleListItem[]; interests: string; onChoose?: (choice: BottleChoice) => string; chatRef?: Ref<OccasionChatHandle>; deferred?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const [notice, setNotice] = useState('');
  function floating() {
    const result = buildWeddingChatPrompt('review', items, interests);
    if (!result.ok) { setNotice(result.error); return; }
    requestPlanningDraft({ source: 'wedding', text: result.text }); setNotice('Draft opened in the floating assistant.');
  }
  return <OccasionChat occasion="weddings" items={items} interests={interests} onChoose={onChoose} chatRef={chatRef} deferred={deferred} onBusyChange={onBusyChange}>
    <button type="button" onClick={floating} className="min-h-10 font-semibold text-[#7c1d1d] underline">Open in floating chat</button>
    {notice && <p role="status">{notice}</p>}
  </OccasionChat>;
}

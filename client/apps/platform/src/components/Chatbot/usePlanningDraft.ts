'use client';

import { useEffect, useState } from 'react';
import { subscribePlanningDraft, type PlanningDraft } from '@/lib/chatPlanning';

export function usePlanningDraft(openChat: (open: boolean) => void) {
  const [planningDraft, setPlanningDraft] = useState<PlanningDraft | null>(null);
  useEffect(() => subscribePlanningDraft(draft => {
    setPlanningDraft(draft);
    openChat(true);
  }), [openChat]);
  return { planningDraft, dismissPlanningDraft: () => setPlanningDraft(null) };
}

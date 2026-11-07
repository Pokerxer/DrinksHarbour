export type PlanningDraft = { source: 'wedding'; text: string };
type Listener = (draft: PlanningDraft) => void;
let pending: PlanningDraft | null = null;
const listeners = new Set<Listener>();

/** Transient handoff only: no storage, history, analytics or network call. */
export function requestPlanningDraft(draft: PlanningDraft): boolean {
  if (draft.source !== 'wedding' || !draft.text.trim() || draft.text.length > 6000) return false;
  if (!listeners.size) pending = { ...draft };
  else { pending = null; for (const listener of listeners) listener({ ...draft }); }
  return true;
}

export function subscribePlanningDraft(listener: Listener): () => void {
  listeners.add(listener);
  if (pending) { const draft = pending; pending = null; listener(draft); }
  return () => { listeners.delete(listener); };
}

export function appendPlanningDraft(current: string, draft: string): string {
  return current.trim() ? `${current}\n\n${draft}` : draft;
}

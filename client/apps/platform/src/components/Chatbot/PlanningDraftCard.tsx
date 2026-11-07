import type { PlanningDraft } from '@/lib/chatPlanning';

export default function PlanningDraftCard({ draft, onUse, onDismiss }: { draft: PlanningDraft; onUse: () => void; onDismiss: () => void }) {
  return <section aria-label="Wedding AI draft" className="shrink-0 border-t border-rose-100 bg-rose-50 p-3">
    <p className="text-xs font-bold text-[#7c1d1d]">Your wedding planning draft</p>
    <p className="mt-1 text-[11px] leading-5 text-gray-600">Review this snapshot of your list. Add it to your message, edit it if needed, then choose Send.</p>
    <pre className="mt-2 max-h-28 select-text overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-rose-100 bg-white p-2 font-sans text-[11px] leading-5 text-gray-700">{draft.text}</pre>
    <div className="mt-2 flex flex-wrap items-center gap-2"><button type="button" onClick={onUse} className="min-h-10 rounded-full bg-[#7c1d1d] px-4 py-2 text-xs font-bold text-white hover:bg-[#571419]">Add list to message</button><button type="button" onClick={onDismiss} className="min-h-10 px-2 text-xs font-semibold text-[#7c1d1d] underline">Dismiss wedding draft</button></div>
  </section>;
}

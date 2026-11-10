'use client';
import { Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import RequestDetail from './request-detail';
import RequestQueue from './request-queue';

/** Two-pane WhatsApp-Web-like staff inbox for the (already live) occasion
 * module: left = the conversation queue; right = the selected request with
 * its saved conversation and the draft/approve compose flow. Selection is
 * synced with `?id=` via history.replaceState (Next integrates shallow
 * updates with useSearchParams), so deep links and the standalone
 * /occasion-requests/[id] detail page keep working — they simply open the
 * detail without the pane. Small screens show one pane at a time, driven by
 * the same selection state. */
export default function OccasionInbox() {
  return <Suspense fallback={<p role="status">Loading staff inbox…</p>}>
    <Inbox />
  </Suspense>;
}

function Inbox() {
  const selectedId = useSearchParams().get('id') || '';
  const select = useCallback((id: string) => {
    window.history.replaceState(null, '', `/occasion-requests${id ? `?id=${id}` : ''}`);
  }, []);
  return <div className="grid items-start gap-5 lg:grid-cols-[minmax(340px,460px)_minmax(0,1fr)]">
    <div className={`min-w-0 lg:sticky lg:top-4 ${selectedId ? 'hidden lg:block' : 'block'}`}>
      <RequestQueue pane selectedId={selectedId} onSelect={select} />
    </div>
    <div className={`min-w-0 ${selectedId ? 'block' : 'hidden lg:block'}`}>
      {selectedId
        ? <RequestDetail key={selectedId} id={selectedId} />
        : <div className="grid h-full min-h-[320px] place-items-center rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm leading-6 text-gray-500 dark:border-gray-700">
          Select a conversation on the left to open its customer request and reply flow.
        </div>}
    </div>
  </div>;
}

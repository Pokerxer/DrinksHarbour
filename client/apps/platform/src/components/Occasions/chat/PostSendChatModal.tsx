'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { PiXBold } from 'react-icons/pi';

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Props = { titleId: string; reference: string; conversationId: string; onClose: () => void; children: ReactNode };
const CONTINUE_HREF = (id: string) => `/my-account/chat/${id}`;

/** Dialog shell: role=dialog + aria-modal, labelled title, keyboard focus trap,
 * Escape closes, and closing hands focus back to the "Continue chat" affordance
 * (handled by the parent controller). Mobile renders as a full-screen sheet.
 * Styling is static — nothing animates, so prefers-reduced-motion is respected
 * by construction. */
export default function PostSendChatModal({ titleId, reference, conversationId, onClose, children }: Props) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    dialog.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      const container = dialog.current;
      if (!container) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1], active = document.activeElement;
      if (event.shiftKey ? active === first || active === container : active === last) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (active !== container && !items.includes(active as HTMLElement)) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);
  return <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
    <button type="button" tabIndex={-1} aria-label="Close conversation" onClick={onClose} className="absolute inset-0 h-full w-full cursor-default bg-black/50" />
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative flex h-[100dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl focus:outline-none sm:h-[min(38rem,85dvh)] sm:max-w-lg sm:rounded-2xl">
      <header className="flex items-start justify-between gap-3 border-b border-gray-100 p-4">
        <div>
          <h2 id={titleId} tabIndex={-1} className="text-lg font-bold text-gray-950">Chat with our team</h2>
          <p className="mt-1 text-xs leading-5 text-gray-500">Request {reference} · people only — no AI joins this conversation.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close conversation" className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-gray-100 text-gray-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]"><PiXBold aria-hidden="true" /></button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      <footer className="border-t border-gray-100 bg-white px-4 py-3">
        <Link href={CONTINUE_HREF(conversationId)} className="text-sm font-semibold text-[#7c1d1d] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]">Open full conversation</Link>
        <p className="mt-1 text-[11px] leading-5 text-gray-500">Your profile chat keeps the whole thread. Team replies are written by people — nothing here is automated or guaranteed to arrive on a timer.</p>
      </footer>
    </div>
  </div>;
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { rememberInvitation, scheduleInvitation } from './chatInvitation';

function getSessionStorage() {
  try { return window.sessionStorage; } catch { return null; }
}

interface ChatLauncherProps {
  isOpen: boolean;
  unread: number;
  onToggle: () => void;
}

export default function ChatLauncher({ isOpen, unread, onToggle }: ChatLauncherProps) {
  const [showInvitation, setShowInvitation] = useState(false);
  const interacted = useRef(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      interacted.current = true;
      rememberInvitation(getSessionStorage());
      setShowInvitation(false);
      return;
    }
    if (interacted.current) return;
    return scheduleInvitation(getSessionStorage(), () => setShowInvitation(true));
  }, [isOpen]);

  const dismissInvitation = () => {
    interacted.current = true;
    rememberInvitation(getSessionStorage());
    setShowInvitation(false);
    buttonRef.current?.focus({ preventScroll: true });
  };

  const toggleChat = () => {
    interacted.current = true;
    rememberInvitation(getSessionStorage());
    setShowInvitation(false);
    onToggle();
  };

  return (
    <div className={`fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:bottom-5 lg:right-5 flex-col items-end gap-3 ${isOpen ? 'hidden lg:flex z-[9999]' : 'flex z-[45]'}`}>
      {showInvitation && !isOpen && (
        <aside aria-label="AI shopping assistant invitation" className="relative w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-red-100 bg-white p-4 pr-10 text-slate-900 shadow-xl">
          <button type="button" onClick={dismissInvitation} aria-label="Dismiss AI invitation"
            className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-700">
            <span aria-hidden="true">×</span>
          </button>
          <p className="text-sm font-semibold">Need help choosing a drink?</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">Ask our AI assistant for ideas for your taste, budget or occasion.</p>
          <button type="button" onClick={toggleChat}
            className="mt-3 min-h-11 rounded-lg px-3 text-sm font-semibold text-red-700 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-700">
            Let’s find your drink →
          </button>
        </aside>
      )}
      <button ref={buttonRef} type="button" onClick={toggleChat}
        aria-label={isOpen ? 'Close chat' : 'Ask AI — open shopping assistant'}
        aria-expanded={isOpen}
        className="relative flex min-h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-br from-red-700 to-red-900 px-5 text-sm font-semibold text-white shadow-xl hover:from-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-700">
        <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          {isOpen ? <path strokeLinecap="round" d="m6 6 12 12M6 18 18 6" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z" />}
        </svg>
        {isOpen ? 'Close chat' : 'Ask AI'}
        {unread > 0 && !isOpen && (
          <span aria-label={`${unread} unread messages`} className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] text-red-700 shadow">{unread}</span>
        )}
      </button>
    </div>
  );
}

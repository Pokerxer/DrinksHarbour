'use client';

import { useEffect, useRef, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

/** Mirrors the server's cap so the form refuses before the request is made. */
const MAX_MESSAGE_LENGTH = 4000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  /** Seeds the box with what the visitor already said, so they don't retype it. */
  initialMessage?: string;
  onCancel: () => void;
  onSent: () => void;
}

/**
 * "Talk to a human" — hands the conversation to the support inbox.
 *
 * The one thing this must never do is claim success it does not have. The
 * visitor is being told a person will reply to them; if the send failed, saying
 * so and leaving their text on screen is the only honest option, because there
 * is no queue behind this and nobody will pick it up later.
 */
export default function TalkToHuman({
  initialMessage = '',
  onCancel,
  onSent,
}: Props) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(initialMessage);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const trimmedEmail = email.trim();
  const trimmedMessage = message.trim();
  const valid =
    EMAIL_RE.test(trimmedEmail) &&
    trimmedMessage.length > 0 &&
    trimmedMessage.length <= MAX_MESSAGE_LENGTH;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/chatbot/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, message: trimmedMessage }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        throw new Error(
          body?.message || `We could not send that (${res.status})`
        );
      }
      onSent();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="px-3 py-2.5 bg-red-50/80 border-t border-red-100 flex-shrink-0"
    >
      <p className="text-[11px] font-semibold text-slate-800 mb-1.5">
        Talk to a human
      </p>
      <p className="text-[10px] text-slate-600 mb-2 leading-snug">
        Leave your email and a note — someone from the team will reply to you
        directly.
      </p>

      <input
        ref={emailRef}
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        aria-label="Your email address"
        className="w-full h-8 rounded-xl border border-slate-200 bg-white px-2.5 text-[11px] text-slate-800 placeholder:text-slate-400 focus:border-red-300 focus:outline-none focus:ring-1 focus:ring-red-200"
      />
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        maxLength={MAX_MESSAGE_LENGTH}
        placeholder="What do you need help with?"
        aria-label="Your message"
        className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-800 placeholder:text-slate-400 focus:border-red-300 focus:outline-none focus:ring-1 focus:ring-red-200"
      />

      {error && (
        <p role="alert" className="mt-1.5 text-[10px] font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="mt-2 flex gap-2">
        <button
          type="submit"
          disabled={!valid || sending}
          className="flex-1 h-8 rounded-xl bg-red-700 text-white text-[11px] font-bold hover:bg-red-800 active:scale-[0.98] disabled:opacity-50 transition-all touch-manipulation"
        >
          {sending ? 'Sending…' : 'Send to the team'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={sending}
          className="px-4 h-8 rounded-xl border border-slate-200 bg-white text-slate-600 text-[11px] font-semibold hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50 transition-all touch-manipulation"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

'use client';
import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { enterSubmitsMessage } from '@/lib/chatKeyboard';

type Props = {
  /** Queues the message optimistically (pending bubble inline) and returns
   * immediately; the composer clears on queue, failures stay on the bubble. */
  onSend: (content: string, existingLocalId?: string) => boolean;
  sending: boolean;
};

/** Plain-text composer — the only control is words. No price, size or pack
 * controls are added to customer messages, matching the intake form rules.
 * Enter submits on a real desktop keyboard (never during IME composition,
 * never on a touch/virtual keyboard); Shift+Enter inserts a newline; the
 * button keeps working everywhere. */
export default function PostSendChatComposer({ onSend, sending }: Props) {
  const [text, setText] = useState('');
  function submit() {
    const value = text.trim();
    if (!value) return;
    if (onSend(value)) setText('');
  }
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!enterSubmitsMessage(event.nativeEvent)) return;
    event.preventDefault();
    if (!sending) submit();
  }
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }
  return <form onSubmit={onSubmit} className="border-t border-gray-100 bg-white p-4" aria-busy={sending}>
    <label htmlFor="post-send-chat-message" className="text-sm font-semibold">Message our team</label>
    <textarea id="post-send-chat-message" aria-describedby="post-send-chat-hint" rows={3} maxLength={4000} value={text} onChange={event => setText(event.target.value)} onKeyDown={onKeyDown} disabled={sending} placeholder="Ask a question or add details about your request…" className="mt-2 w-full rounded-lg border border-gray-300 p-3 text-base text-gray-900 focus:border-[#7c1d1d] focus:outline-none focus:ring-2 focus:ring-[#7c1d1d]/20 disabled:opacity-60" />
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <p id="post-send-chat-hint" className="text-xs leading-6 text-gray-600">{text.length}/4,000 · Avoid payment or private guest details.</p>
      <button type="submit" disabled={sending || !text.trim()} className="min-h-11 rounded-full bg-[#7c1d1d] px-5 py-2 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d] disabled:opacity-50">{sending ? 'Sending…' : 'Send message'}</button>
    </div>
  </form>;
}

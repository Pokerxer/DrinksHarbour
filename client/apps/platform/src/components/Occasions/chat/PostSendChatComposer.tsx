'use client';
import { useState } from 'react';
import ChatComposer from '@/components/chat-ui/ChatComposer';

type Props = {
  /** Queues the message optimistically (pending bubble inline) and returns
   * immediately; the composer clears on queue, failures stay on the bubble. */
  onSend: (content: string, existingLocalId?: string) => boolean;
  sending: boolean;
};

/** Plain-text composer — the only control is words. No price, size or pack
 * controls are added to customer messages, matching the intake form rules.
 * Styling/keyboard grammar come from the shared chat-ui composer so the modal
 * pane and /my-account/chat stay visually consistent. The stable textarea id
 * (`post-send-chat-message`) is preserved for tests. */
export default function PostSendChatComposer({ onSend, sending }: Props) {
  const [text, setText] = useState('');
  return <ChatComposer
    id="post-send-chat-message"
    label="Message our team"
    hint="Avoid payment or private guest details."
    hintId="post-send-chat-hint"
    buttonLabel="Send message"
    sendingLabel="Sending…"
    sending={sending}
    value={text}
    onChange={setText}
    onSend={() => { const value = text.trim(); if (value && onSend(value)) setText(''); }}
  />;
}

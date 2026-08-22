/**
 * The chatbot conversation, for as long as this visit lasts.
 *
 * The web stores it in **sessionStorage** under `dh-chatbot-session-v1`
 * (`ChatbotWidget.tsx:297`, `:315`, `:700`) — not localStorage. sessionStorage
 * is scoped to the tab and dies when the tab closes.
 *
 * React Native has neither API. A module-level store is the honest analogue:
 * it survives switching tabs and navigating within the app — which is what the
 * mobile Chat tab needs, since leaving the tab unmounts the screen — and it is
 * gone when the app is killed. AsyncStorage was considered and rejected: it
 * would make the mobile conversation outlive the web's, which is a behaviour
 * change dressed up as a port.
 */

import type { CartProposalItem, QuickReply } from './chatbot-api.ts';

/** Kept as the web's key so both apps name the same thing, even unstored. */
export const CHAT_SESSION_KEY = 'dh-chatbot-session-v1';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatSession {
  messages: ChatMessage[];
  quickReplies: QuickReply[];
  pendingCart: CartProposalItem[] | null;
}

const EMPTY: ChatSession = { messages: [], quickReplies: [], pendingCart: null };

let session: ChatSession = EMPTY;

/** A copy, so a caller mutating the result cannot corrupt the store. */
export function readChatSession(): ChatSession {
  return {
    messages: [...session.messages],
    quickReplies: [...session.quickReplies],
    pendingCart: session.pendingCart ? [...session.pendingCart] : null,
  };
}

export function writeChatSession(next: ChatSession): void {
  session = {
    messages: [...next.messages],
    quickReplies: [...next.quickReplies],
    pendingCart: next.pendingCart ? [...next.pendingCart] : null,
  };
}

export function clearChatSession(): void {
  session = EMPTY;
}

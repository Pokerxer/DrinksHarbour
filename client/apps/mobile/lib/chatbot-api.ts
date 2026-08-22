/**
 * The chatbot's three endpoints (`server/routes/chatbot.routes.js`).
 *
 * These deliberately use bare `fetch`, not `apiFetch`:
 *   1. all three are PUBLIC — no Authorization header is wanted;
 *   2. `apiFetch` sets `Content-Type: application/json` on every request, and
 *      `/query` is MULTIPART. Setting that header by hand omits the multipart
 *      boundary, and multer then fails to parse the body in a way that reads
 *      exactly like a server bug. React Native's fetch generates the boundary
 *      itself — but only if the header is left alone.
 */

import { getApiBaseUrl } from 'commerce-core';

export type ChatResult<T> = { ok: true; data: T } | { ok: false; error: string };

const GENERIC_ERROR = 'The assistant is unavailable right now.';

/** The server's structured cart offer, parsed from the model's CART_JSON line. */
export interface CartProposalItem {
  id: string;
  slug: string;
  name: string;
  size: string | null;
  qty: number;
  price: number;
  image: string | null;
}

/** Server-supplied chips. Sometimes an object, sometimes a bare string. */
export type QuickReply = { label: string; query: string } | string;

export interface ChatTurn {
  response: string;
  quickReplies: QuickReply[];
  cartProposal: CartProposalItem[];
}

export interface HistoryEntry {
  role: string;
  content: string;
}

/** The web sends the last ten turns (`ChatbotWidget.tsx:577`). */
const HISTORY_TURNS = 10;

function readTurn(payload: unknown): ChatTurn {
  const data = (payload as Record<string, any> | null)?.data ?? {};
  return {
    response: typeof data.response === 'string' ? data.response : '',
    quickReplies: Array.isArray(data.quickReplies) ? data.quickReplies : [],
    cartProposal: Array.isArray(data.cartProposal) ? data.cartProposal : [],
  };
}

function errorOf(payload: unknown): string {
  const message = (payload as { message?: unknown } | null)?.message;
  return typeof message === 'string' && message ? message : GENERIC_ERROR;
}

/**
 * `success:false` on an HTTP 200 is a real case here — the controller answers
 * 200 with a failure body when the model returns nothing — so the flag is
 * checked as well as the status.
 */
async function readResponse(response: Response): Promise<ChatResult<ChatTurn>> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }

  if (!response.ok) return { ok: false, error: errorOf(payload) };
  if ((payload as { success?: unknown })?.success !== true) {
    return { ok: false, error: errorOf(payload) };
  }
  return { ok: true, data: readTurn(payload) };
}

export async function fetchGreeting(): Promise<ChatResult<ChatTurn>> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/chatbot/greeting`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return await readResponse(response);
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}

/**
 * Text only. Image and document attachments are out of scope — they need
 * `expo-image-picker` / `expo-document-picker`, and RN's FormData takes
 * `{uri, name, type}` rather than a File. The server still accepts up to 5
 * images and 1 document on this same endpoint.
 */
export async function sendChatQuery(
  query: string,
  history: HistoryEntry[]
): Promise<ChatResult<ChatTurn>> {
  try {
    const form = new FormData();
    if (query) form.append('query', query);
    form.append('conversationHistory', JSON.stringify(history.slice(-HISTORY_TURNS)));

    // No `headers` at all — see the note at the top of this file.
    const response = await fetch(`${getApiBaseUrl()}/api/chatbot/query`, {
      method: 'POST',
      body: form,
    });
    return await readResponse(response);
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}

/**
 * Hand the conversation to a person.
 *
 * Rate-limited to 5 per 10 minutes, and it is the only public endpoint that
 * makes the server emit mail — so its refusal message is surfaced verbatim
 * rather than replaced with a generic failure.
 */
export async function escalateToHuman(input: {
  email: string;
  message: string;
  history: HistoryEntry[];
  name?: string;
}): Promise<ChatResult<null>> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/chatbot/escalate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: input.email,
        name: input.name ?? '',
        message: input.message,
        conversationHistory: input.history.slice(-HISTORY_TURNS),
      }),
    });

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      return { ok: false, error: GENERIC_ERROR };
    }

    if (!response.ok || (payload as { success?: unknown })?.success !== true) {
      return { ok: false, error: errorOf(payload) };
    }
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}

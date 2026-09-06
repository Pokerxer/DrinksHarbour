'use strict';

/**
 * Input caps for the public chatbot.
 *
 * /api/chatbot/query is unauthenticated and every field on it is forwarded to a
 * paid model. Rate limiting bounds how *often* a stranger can call it; these
 * caps bound how *much* each call costs. Without them one request could carry
 * megabytes of `conversationHistory` — parsed, then billed as input tokens —
 * and a malformed history string threw inside the controller's try/catch and
 * surfaced as an opaque 500 rather than the 400 it is.
 *
 * Pure functions, no express and no I/O, so the caps can be asserted directly.
 */

const MAX_QUERY_CHARS = 2000;

// The raw string is checked before JSON.parse touches it: parsing a 50 MB
// string is itself the denial of service, so the length test has to come first.
const MAX_HISTORY_RAW_CHARS = 200_000;

const MAX_HISTORY_TURNS = 20;
const MAX_HISTORY_CHARS_PER_TURN = 4000;
const MAX_HISTORY_CHARS_TOTAL = 24_000;

/** Trim and cap a free-text query. Anything that is not a string becomes ''. */
const clampQuery = (raw) => {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, MAX_QUERY_CHARS);
};

/**
 * Parse and bound the conversation history a client sends up.
 *
 * Returns `{ history, error }`. `error` is a caller-facing sentence when the
 * input is unusable — the controller turns that into a 400 — and `null`
 * otherwise. It never throws: a stranger's bad JSON is not a server fault.
 *
 * Accepts either the JSON string multipart gives us or an already-parsed array.
 */
const parseConversationHistory = (raw) => {
  if (raw === undefined || raw === null || raw === '') {
    return { history: [], error: null };
  }

  let parsed = raw;
  if (typeof raw === 'string') {
    if (raw.length > MAX_HISTORY_RAW_CHARS) {
      return { history: [], error: 'Conversation history is too large.' };
    }
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { history: [], error: 'conversationHistory is not valid JSON.' };
    }
  }

  if (!Array.isArray(parsed)) {
    return { history: [], error: 'conversationHistory must be an array.' };
  }

  const normalised = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const content = typeof entry.content === 'string' ? entry.content.trim() : '';
    if (!content) continue;
    // 'assistant' or nothing. A visitor may not label their own text 'system' —
    // that is the role that would let a stranger prepend instructions to the
    // model's prompt through a field the widget never sets.
    const role = entry.role === 'assistant' ? 'assistant' : 'user';
    normalised.push({ role, content: content.slice(0, MAX_HISTORY_CHARS_PER_TURN) });
  }

  // Keep the tail: the recent turns are the ones carrying the context, so the
  // turn budget and the character budget both drop from the front.
  let history = normalised.slice(-MAX_HISTORY_TURNS);

  let total = history.reduce((n, h) => n + h.content.length, 0);
  while (history.length > 1 && total > MAX_HISTORY_CHARS_TOTAL) {
    total -= history[0].content.length;
    history = history.slice(1);
  }

  return { history, error: null };
};

module.exports = {
  clampQuery,
  parseConversationHistory,
  MAX_QUERY_CHARS,
  MAX_HISTORY_RAW_CHARS,
  MAX_HISTORY_TURNS,
  MAX_HISTORY_CHARS_PER_TURN,
  MAX_HISTORY_CHARS_TOTAL,
};

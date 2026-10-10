/**
 * Completeness reporting for paged POS list endpoints.
 *
 * A list endpoint has to cap how much it will return, but a cap that the client
 * cannot see is a lie. This module turns the numbers a handler already has
 * (how many orders matched, how many it actually sent, what page size it granted)
 * into the single authoritative statement of whether the view is complete.
 *
 * The client must render whatever `truncated` says. It must never re-derive
 * completeness from a row count — that inference is what allowed a "Load all"
 * button to silently show only the newest 500 receipts while reporting the data
 * as complete.
 */

/** Hard ceiling on one page. A tenant past this gets an explicit `truncated`. */
const MAX_PAGE_LIMIT = 2000;

const DEFAULT_LIMIT = 200;

function buildPageMeta({ matched, included, limit } = {}) {
  const total = Math.max(0, Number(matched) || 0);
  const sent = Math.max(0, Number(included) || 0);
  // The granted page size is the ceiling itself when a client asks for more,
  // because the ceiling is what actually happened.
  const asked = Number(limit) || DEFAULT_LIMIT;
  const granted = Math.min(Math.max(1, asked), MAX_PAGE_LIMIT);
  const missing = Math.max(0, total - sent);

  return {
    matched: total,
    included: sent,
    limit: granted,
    missing,
    truncated: missing > 0,
  };
}

/** Parse and clamp a `?limit=` query value. Never returns less than 1. */
function resolvePageLimit(raw, fallback = DEFAULT_LIMIT) {
  const asked = parseInt(raw, 10);
  if (!Number.isFinite(asked) || asked <= 0) return fallback;
  return Math.min(asked, MAX_PAGE_LIMIT);
}

module.exports = { buildPageMeta, resolvePageLimit, MAX_PAGE_LIMIT, DEFAULT_LIMIT };

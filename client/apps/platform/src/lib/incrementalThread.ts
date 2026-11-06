/** Shared `after`-cursor helpers for the two customer-thread pollers
 * (`useOccasionThread` and ConversationPage). The backend's after mode
 * (DRI-26) returns only messages strictly newer than the cursor, ascending,
 * capped at 30, with the request brief riding along. The full read stays the
 * fallback whenever that contract cannot be confirmed client-side. */

/** Message count after which the server page is "full" and the poller
 * re-pages immediately instead of waiting for the next tick. */
export const FULL_PAGE = 30;

export const isLocalId = (id: string) => id.startsWith('local:');

/** Newest server `_id` in the list. Optimistic `local:*` placeholders are
 * never server documents and must never feed cursor math. */
export function newestServerId(messages: { _id: string }[]): string {
  for (let index = messages.length - 1; index >= 0; index--) {
    const id = messages[index]._id;
    if (!isLocalId(id)) return id;
  }
  return '';
}

/** Splits an incremental response into its genuinely-newer part. `clear` is
 * false when the response contains anything at-or-before the cursor (the
 * server ignored `after`, e.g. a legacy or full read) — callers then fall
 * back to the full read for the same tick. */
export function incrementalSplit<T extends { _id: string }>(messages: T[], after: string): { newer: T[]; clear: boolean } {
  const clear = messages.every(message => !isLocalId(message._id) && message._id.localeCompare(after) > 0);
  return { newer: clear ? messages : [], clear };
}

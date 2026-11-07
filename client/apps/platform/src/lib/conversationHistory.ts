type MessageIdentity = { _id: string };
type History<T> = { messages: T[]; olderCursor: string | null };
/** Keep loaded history while allowing a long-offline tab to fetch missing middle messages. */
export function mergeConversationHistory<T extends MessageIdentity>(previous: History<T> | undefined, next: History<T>): History<T> {
  const known = new Set(previous?.messages.map(message => message._id));
  const gap = Boolean(previous?.messages.length && next.messages.length && next.olderCursor && !next.messages.some(message => known.has(message._id)));
  return {
    messages: [...new Map([...(previous?.messages || []), ...next.messages].map(message => [message._id, message])).values()].sort((a, b) => a._id.localeCompare(b._id)),
    olderCursor: !previous || gap ? next.olderCursor : previous.olderCursor,
  };
}

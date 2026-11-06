/** WAT (Africa/Lagos) day/time formatting shared by every customer chat
 * surface — /occasions post-send pane and /my-account/chat/[id] render
 * identical labels so a thread reads the same wherever it opens. */

const WAT = 'Africa/Lagos';

const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: WAT, year: 'numeric', month: '2-digit', day: '2-digit' });
const legacyDateFormatter = new Intl.DateTimeFormat('en-NG', { timeZone: WAT, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const timeFormatter = new Intl.DateTimeFormat('en-NG', { timeZone: WAT, hour: '2-digit', minute: '2-digit' });

/** Grouping label for a message timestamp: Today / Yesterday / plain date,
 * always judged against the WAT calendar (fixed UTC+1, no DST). Malformed
 * timestamps fall through to a plain-date label rather than throwing. */
export function chatDayLabel(timestamp: string, now: Date = new Date()): string {
  const message = new Date(timestamp);
  if (Number.isNaN(message.getTime())) return legacyDateFormatter.format(now);
  const messageDay = dayKeyFormatter.format(message);
  if (messageDay === dayKeyFormatter.format(now)) return 'Today';
  if (messageDay === dayKeyFormatter.format(new Date(now.getTime() - 86400000))) return 'Yesterday';
  return legacyDateFormatter.format(message);
}

/** Time-of-day line under a bubble, e.g. "12:05 pm" — the day header above the
 * group carries the date. */
export function chatTimeLabel(timestamp: string): string {
  const message = new Date(timestamp);
  if (Number.isNaN(message.getTime())) return 'Invalid time';
  return timeFormatter.format(message);
}

/** Auth failures must not dead-end on error copy: surfaces a sign-in route
 * that returns the customer to the same conversation. */
export function isAuthChatError(message: string): boolean {
  return /sign in|log ?in|401|unauthori[sz]|not authori|session|expired/i.test(message);
}

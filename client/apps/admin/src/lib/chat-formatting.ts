/** WAT (Africa/Lagos) time formatting shared by the staff conversation
 * panel — labels must match the customer's chat rendering byte for byte, so
 * this mirrors the platform app's lib/chatFormatting (fixed UTC+1, no DST).
 * Malformed timestamps fall through to a plain-date/literal label rather than
 * throwing. */

const WAT = 'Africa/Lagos';

const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: WAT, year: 'numeric', month: '2-digit', day: '2-digit' });
const legacyDateFormatter = new Intl.DateTimeFormat('en-NG', { timeZone: WAT, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const timeFormatter = new Intl.DateTimeFormat('en-NG', { timeZone: WAT, hour: '2-digit', minute: '2-digit' });

/** Grouping label for a message timestamp: Today / Yesterday / plain date,
 * always judged against the WAT calendar. */
export function chatDayLabel(timestamp: string, now: Date = new Date()): string {
  const message = new Date(timestamp);
  if (Number.isNaN(message.getTime())) return legacyDateFormatter.format(now);
  const messageDay = dayKeyFormatter.format(message);
  if (messageDay === dayKeyFormatter.format(now)) return 'Today';
  if (messageDay === dayKeyFormatter.format(new Date(now.getTime() - 86400000))) return 'Yesterday';
  return legacyDateFormatter.format(message);
}

/** Time-of-day line inside a bubble meta row, e.g. "12:05 pm"; the day header
 * above the group carries the date. */
export function chatTimeLabel(timestamp: string): string {
  const message = new Date(timestamp);
  if (Number.isNaN(message.getTime())) return 'Invalid time';
  return timeFormatter.format(message);
}

/** Wall time is always interpreted in the venue's IANA zone, never the browser's. */
export function venueWallTime(instant: string | Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant));
  const read = (type: string) => parts.find(part => part.type === type)?.value || '';
  return `${read('year')}-${read('month')}-${read('day')}T${read('hour')}:${read('minute')}`;
}
export function venueLocalToInstant(wall: string, timezone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(wall)) throw new Error('Choose a valid venue date and time');
  const nominal = Date.parse(`${wall}:00Z`);
  const candidates: string[] = [];
  // Contemporary IANA offsets fit quarter-hour increments in [-14h,+14h].
  // Enumerating candidates also detects repeated/skipped DST wall times.
  for (let offset = -840; offset <= 840; offset += 15) {
    const instant = new Date(nominal - offset * 60000);
    if (Number.isFinite(instant.getTime()) && venueWallTime(instant, timezone) === wall) candidates.push(instant.toISOString());
  }
  if (!candidates.length) throw new Error('That local time does not exist; choose another time');
  if (candidates.length > 1) throw new Error('That local time is ambiguous; choose another time');
  return candidates[0];
}

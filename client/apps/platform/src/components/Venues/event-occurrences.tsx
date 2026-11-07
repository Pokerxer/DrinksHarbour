import type { PublicEventOccurrence, VenueLocation } from '@/lib/venue/types';

const focus =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-800 focus-visible:ring-offset-2';

function formatDay(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-NG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// Times render in the venue's own clock — the service date is the venue-local date.
function formatTime(instant: string, timezone: string) {
  return new Date(instant).toLocaleTimeString('en-NG', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  });
}

function OccurrenceCard({
  occurrence,
  timezone,
}: {
  occurrence: PublicEventOccurrence;
  timezone: string;
}) {
  const heading = `${occurrence.name} on ${formatDay(occurrence.occurrenceDate)}`;
  return (
    <li className="space-y-2 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold">{heading}</h3>
      <p className="text-sm leading-6 text-stone-700">
        {formatTime(occurrence.startAt, timezone)}–
        {formatTime(occurrence.endAt, timezone)} venue time
        {occurrence.minimumAge ? ` · ${occurrence.minimumAge}+ with ID` : ''}
      </p>
      <p className="whitespace-pre-wrap text-sm leading-6 text-stone-600">
        {occurrence.admissionTerms}
      </p>
      <p className="text-sm leading-6 text-stone-600">{occurrence.availability.message}</p>
      <p className="text-sm leading-6 text-stone-600">
        Contact the venue to arrange entry — no booking or payment happens on this page.
      </p>
    </li>
  );
}

export default function EventOccurrences({ venue }: { venue: VenueLocation }) {
  const items = venue.events?.items ?? [];
  return (
    <section
      className="space-y-6 rounded-2xl border border-stone-200 bg-stone-50 p-5 sm:p-6"
      id="events"
      aria-label="Events at this location"
    >
      <h2 className="text-2xl font-bold">Events</h2>
      <p className="max-w-2xl leading-7 text-stone-600">
        Upcoming published events at this location. Entry is arranged with the venue
        directly; capacity is limited and availability may change.
      </p>
      {!items.length && (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-10 text-center text-stone-600">
          No upcoming events have been published for this location yet. Check back
          soon or contact the venue.
        </p>
      )}
      <ul className="grid gap-4 sm:grid-cols-2">
        {items.map((occurrence) => (
          <OccurrenceCard
            key={`${occurrence.eventSlug}:${occurrence.occurrenceDate}`}
            occurrence={occurrence}
            timezone={venue.timezone}
          />
        ))}
      </ul>
      <p className={`text-sm underline-offset-4 ${focus}`}>
        Events are listed for information only; this page never takes bookings or
        payments for them.
      </p>
    </section>
  );
}

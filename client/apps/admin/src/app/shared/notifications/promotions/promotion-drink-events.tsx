'use client';
import type { PromotionOccasion } from '@/services/promotionSuggestions.service';
export default function PromotionDrinkEvents({
  events,
  name,
  date,
  disabled,
  choose,
}: {
  events: PromotionOccasion[];
  name: string;
  date: string;
  disabled: boolean;
  choose: (event: PromotionOccasion) => void;
}) {
  const selected = events.find((e) => e.name === name && e.date === date);
  return (
    <div className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
      {events.length ? (
        <>
          <label className="block text-xs font-semibold">
            World drinks event
            <select
              aria-label="World drinks event"
              disabled={disabled}
              value={selected ? `${selected.name}|${selected.date}` : ''}
              onChange={(e) => {
                const event = events.find(
                  (v) => `${v.name}|${v.date}` === e.target.value
                );
                if (event) choose(event);
              }}
              className="mt-1 block w-full rounded-lg border border-blue-200 bg-white p-3 text-sm font-normal disabled:opacity-50"
            >
              <option value="" disabled>
                Choose a world drinks event
              </option>
              {events.map((e) => (
                <option
                  key={`${e.name}:${e.date}`}
                  value={`${e.name}|${e.date}`}
                >
                  {e.name} · {e.date}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-2 text-xs">
            Verified dates in the next 60 days. Suggestions match the event to
            relevant drinks; an event does not prove increased demand.
          </p>
          {selected?.sourceUrl && (
            <a
              className="mt-2 inline-block text-xs font-semibold underline"
              href={selected.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Event source
            </a>
          )}
        </>
      ) : (
        <p className="text-xs">
          No verified world drinks events in the next 60 days. You can still
          choose your own special day.
        </p>
      )}
    </div>
  );
}

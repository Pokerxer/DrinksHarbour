'use client';
import { useState } from 'react';
import PromotionSpecialDay from './promotion-special-day';
import PromotionDrinkEvents from './promotion-drink-events';
import type { PromotionOccasion } from '@/services/promotionSuggestions.service';
export interface OfferSettings {
  maxDiscount: string;
  marginFloor: string;
  eventName: string;
  eventDate: string;
}
export const defaultSettings: OfferSettings = {
  maxDiscount: '10',
  marginFloor: '20',
  eventName: '',
  eventDate: '',
};
export default function PromotionSettings({
  canPrice,
  apply,
  disabled,
  occasions = [],
}: {
  canPrice: boolean;
  apply: (s: OfferSettings) => void;
  disabled: boolean;
  occasions?: PromotionOccasion[];
}) {
  const [draft, setDraft] = useState(defaultSettings),
    [error, setError] = useState('');
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const lastDay = new Date(Date.parse(today) + 60 * 86400000)
    .toISOString()
    .slice(0, 10);
  const drinkEvents = occasions.filter(
    (e) => e.kind === 'drinks' && e.date >= today && e.date <= lastDay
  );
  const change = (key: keyof OfferSettings, value: string) =>
    setDraft((s) => ({ ...s, [key]: value }));
  return (
    <form
      className="rounded-2xl border bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (disabled) return;
        if (
          !draft.maxDiscount ||
          !draft.marginFloor ||
          !Number.isFinite(+draft.maxDiscount) ||
          +draft.maxDiscount < 0 ||
          +draft.maxDiscount > 50 ||
          !Number.isFinite(+draft.marginFloor) ||
          +draft.marginFloor < 0 ||
          +draft.marginFloor > 90 ||
          !!draft.eventName.trim() !== !!draft.eventDate
        ) {
          setError(
            'Choose a valid discount ceiling, margin floor and paired special-day name/date.'
          );
          return;
        }
        if (
          draft.eventDate &&
          (draft.eventDate < today || draft.eventDate > lastDay)
        ) {
          setError(
            'Choose a special day within the next 60 days, using Lagos dates.'
          );
          return;
        }
        setError('');
        apply({ ...draft, eventName: draft.eventName.trim() });
      }}
    >
      <h2 className="text-sm font-semibold">Offer settings</h2>
      <p className="mt-1 text-xs text-gray-500">
        Settings affect suggestions only. Enter movable holidays or your own
        special day with a confirmed date.
      </p>
      <PromotionDrinkEvents
        events={drinkEvents}
        name={draft.eventName}
        date={draft.eventDate}
        disabled={disabled}
        choose={(event) => {
          setDraft((s) => ({
            ...s,
            eventName: event.name,
            eventDate: event.date,
          }));
          setError('');
        }}
      />
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {canPrice && (
          <>
            <label className="text-xs font-semibold text-gray-600">
              Maximum discount (%)
              <input
                type="number"
                min={0}
                max={50}
                step="0.01"
                value={draft.maxDiscount}
                onChange={(e) => change('maxDiscount', e.target.value)}
                className="mt-1 block w-full rounded-lg !border border-gray-300 p-3 text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-gray-600">
              Minimum gross margin (%)
              <input
                type="number"
                min={0}
                max={90}
                step="0.01"
                value={draft.marginFloor}
                onChange={(e) => change('marginFloor', e.target.value)}
                className="mt-1 block w-full rounded-lg !border border-gray-300 p-3 text-sm"
              />
            </label>
          </>
        )}
        <label className="text-xs font-semibold text-gray-600">
          Special day name
          <input
            maxLength={100}
            value={draft.eventName}
            onChange={(e) => change('eventName', e.target.value)}
            placeholder="Shop anniversary, holiday or event"
            className="mt-1 block w-full rounded-lg !border border-gray-300 p-3 text-sm"
          />
        </label>
        <PromotionSpecialDay
          value={draft.eventDate}
          min={today}
          max={lastDay}
          disabled={disabled}
          eventDates={drinkEvents.map((e) => e.date)}
          onChange={(value) => {
            change('eventDate', value);
            setError('');
          }}
          canClear={!!draft.eventName || !!draft.eventDate}
          clear={() => {
            setDraft((s) => ({ ...s, eventName: '', eventDate: '' }));
            setError('');
          }}
        />
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-3">
        <button
          type="submit"
          disabled={disabled}
          className="rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Apply offer settings
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setDraft(defaultSettings);
            setError('');
            apply(defaultSettings);
          }}
          className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50"
        >
          Reset settings
        </button>
      </div>
    </form>
  );
}

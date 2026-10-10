'use client';
import { useId } from 'react';
import { DatePicker } from '@core/ui/datepicker';
import { PiCalendarBlank } from 'react-icons/pi';
const calendarDate = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
};
const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export default function PromotionSpecialDay({
  value,
  min,
  max,
  disabled,
  onChange,
  clear,
  canClear,
  eventDates = [],
}: {
  value: string;
  min: string;
  max: string;
  disabled: boolean;
  onChange: (value: string) => void;
  clear: () => void;
  canClear: boolean;
  eventDates?: string[];
}) {
  const id = useId();
  const selected = value ? calendarDate(value) : null;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-semibold text-gray-600">
        Special day date
      </label>
      <DatePicker
        id={id}
        selected={selected}
        highlightDates={eventDates.map(calendarDate)}
        minDate={calendarDate(min)}
        maxDate={calendarDate(max)}
        openToDate={selected || calendarDate(min)}
        onChange={(date: Date | null) => onChange(date ? dateKey(date) : '')}
        disabled={disabled}
        popperPlacement="bottom-start"
        customInput={
          <button
            type="button"
            aria-label="Special day date"
            aria-haspopup="dialog"
            disabled={disabled}
            className="flex w-full items-center gap-2 rounded-lg border border-gray-300 bg-white p-3 text-left text-sm font-normal disabled:opacity-50"
          >
            <PiCalendarBlank
              aria-hidden="true"
              className="h-5 w-5 shrink-0 text-gray-500"
            />
            {selected
              ? new Intl.DateTimeFormat('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }).format(selected)
              : 'Choose a date'}
          </button>
        }
      />
      <p className="text-xs text-gray-500">
        Today through the next 60 days · Lagos dates
      </p>
      {canClear && (
        <button
          type="button"
          disabled={disabled}
          onClick={clear}
          className="text-xs font-semibold text-[#b20202] underline disabled:opacity-50"
        >
          Clear special day
        </button>
      )}
    </div>
  );
}

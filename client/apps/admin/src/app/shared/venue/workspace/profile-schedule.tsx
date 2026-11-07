'use client';
import { Trash2 } from 'lucide-react';
import type { Profile } from '@/services/venue/experience';
import { buttonClass, fieldClass, hintClass } from './controls';

const DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export default function ProfileSchedule({
  draft,
  field,
}: {
  draft: Profile;
  field: (name: keyof Profile, value: unknown) => void;
}) {
  return (
    <>
      <fieldset className="space-y-2">
        <legend className="text-base font-semibold">
          Weekly opening hours · {draft.timezone}
        </legend>
        <p className={hintClass}>
          Guests see these windows as requestable times. Use “Closes next day”
          when a window ends after midnight.
        </p>
        {draft.hours.map((hours, index) => (
          <div
            key={index}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-muted bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/60"
          >
            <select
              aria-label={`Day ${index + 1}`}
              className={`${fieldClass} w-auto`}
              value={hours.day}
              onChange={(e) =>
                field(
                  'hours',
                  draft.hours.map((h, i) =>
                    i === index ? { ...h, day: Number(e.target.value) } : h,
                  ),
                )
              }
            >
              {DAYS.map((day, i) => (
                <option key={day} value={i}>
                  {day}
                </option>
              ))}
            </select>
            {(['opens', 'closes'] as const).map((key) => (
              <label
                key={key}
                className="text-sm font-medium capitalize"
              >
                {key}
                <input
                  type="time"
                  required
                  className={`${fieldClass} w-auto`}
                  value={hours[key]}
                  onChange={(e) =>
                    field(
                      'hours',
                      draft.hours.map((h, i) =>
                        i === index ? { ...h, [key]: e.target.value } : h,
                      ),
                    )
                  }
                />
              </label>
            ))}
            <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="size-4 rounded border-gray-400"
                checked={!!hours.overnight}
                onChange={(e) =>
                  field(
                    'hours',
                    draft.hours.map((h, i) =>
                      i === index
                        ? { ...h, overnight: e.target.checked }
                        : h,
                    ),
                  )
                }
              />{' '}
              Closes next day
            </label>
            <button
              type="button"
              aria-label={`Remove ${DAYS[hours.day] || 'day'} hours ${index + 1}`}
              onClick={() =>
                field(
                  'hours',
                  draft.hours.filter((_, i) => i !== index),
                )
              }
              className={buttonClass}
            >
              <Trash2 aria-hidden="true" className="size-4" />
              Remove hours {index + 1}
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            field('hours', [
              ...draft.hours,
              { day: 1, opens: '18:00', closes: '23:00' },
            ])
          }
          className={buttonClass}
        >
          Add opening hours
        </button>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-base font-semibold">
          Opening exceptions
        </legend>
        <p className={hintClass}>
          One-off dates such as public holidays. Mark a date “Closed” to block
          requests, or set different hours for that day.
        </p>
        {draft.exceptions.map((exception, index) => (
          <div
            key={index}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-muted bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/60"
          >
            <label className="text-sm font-medium">
              Date
              <input
                required
                type="date"
                className={`${fieldClass} w-auto`}
                value={exception.date}
                onChange={(e) =>
                  field(
                    'exceptions',
                    draft.exceptions.map((v, i) =>
                      i === index ? { ...v, date: e.target.value } : v,
                    ),
                  )
                }
              />
            </label>
            <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="size-4 rounded border-gray-400"
                checked={exception.closed}
                onChange={(e) =>
                  field(
                    'exceptions',
                    draft.exceptions.map((v, i) =>
                      i === index ? { ...v, closed: e.target.checked } : v,
                    ),
                  )
                }
              />{' '}
              Closed
            </label>
            {!exception.closed && (
              <>
                {(['opens', 'closes'] as const).map((key) => (
                  <label
                    key={key}
                    className="text-sm font-medium capitalize"
                  >
                    {key}
                    <input
                      type="time"
                      required
                      className={`${fieldClass} w-auto`}
                      value={exception[key] || ''}
                      onChange={(e) =>
                        field(
                          'exceptions',
                          draft.exceptions.map((v, i) =>
                            i === index
                              ? { ...v, [key]: e.target.value }
                              : v,
                          ),
                        )
                      }
                    />
                  </label>
                ))}
                <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-gray-400"
                    aria-label={`Closes next day for exception ${index + 1}`}
                    checked={!!exception.overnight}
                    onChange={(e) =>
                      field(
                        'exceptions',
                        draft.exceptions.map((v, i) =>
                          i === index
                            ? { ...v, overnight: e.target.checked }
                            : v,
                        ),
                      )
                    }
                  />{' '}
                  Closes next day
                </label>
              </>
            )}
            <button
              type="button"
              onClick={() =>
                field(
                  'exceptions',
                  draft.exceptions.filter((_, i) => i !== index),
                )
              }
              className={buttonClass}
            >
              <Trash2 aria-hidden="true" className="size-4" />
              Remove exception {index + 1}
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            field('exceptions', [
              ...draft.exceptions,
              { date: '', closed: true },
            ])
          }
          className={buttonClass}
        >
          Add opening exception
        </button>
      </fieldset>
    </>
  );
}

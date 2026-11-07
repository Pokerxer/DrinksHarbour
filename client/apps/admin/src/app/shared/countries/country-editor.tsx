'use client';
import { useRef, useState } from 'react';
import type { CountryConfiguration } from '@/services/country.service';
import {
  buttonClass as foundationButton,
  fieldClass as foundationField,
  helperClass,
  useUnsavedGuard,
} from '../market-foundation/workspace';
export const fieldClass = foundationField;
export const actionClass = foundationButton;
export default function CountryEditor({
  country,
  busy,
  canSave,
  save,
}: {
  country?: CountryConfiguration;
  busy: boolean;
  canSave: boolean;
  save: (data: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({
    code: country?.code || '',
    name: country?.name || '',
    currency: country?.currency || '',
    locale: country?.locale || '',
    timezones: country?.timezones.join(', ') || '',
  });
  const [capabilities, setCapabilities] = useState(
    country?.capabilities || {
      marketplace: false,
      storefront: false,
      erm: false,
    }
  );
  const initial = useRef(JSON.stringify({ form, capabilities }));
  const unsaved =
    JSON.stringify({ form, capabilities }) !== initial.current;
  useUnsavedGuard(unsaved);
  const [errors, setErrors] = useState<Record<string, string>>({});
  function blur(key: keyof typeof form) {
    const value = form[key].trim();
    setErrors((current) => ({
      ...current,
      [key]:
        !value
          ? 'This field is required for a launch review.'
          : key === 'code'
            ? /^[A-Za-z]{2}$/.test(value)
              ? ''
              : 'Use the two-letter ISO country code.'
            : key === 'currency'
              ? /^[A-Za-z]{3}$/.test(value)
                ? ''
                : 'Use the three-letter currency code.'
              : '',
    }));
  }
  const labels: Record<keyof typeof form, string> = {
    code: 'ISO country code',
    name: 'Country name',
    currency: 'Transaction currency',
    locale: 'Locale',
    timezones: 'Timezones (comma separated)',
  };
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save({
          ...form,
          code: form.code.toUpperCase(),
          currency: form.currency.toUpperCase(),
          timezones: form.timezones
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          capabilities,
        });
      }}
      className="space-y-5"
    >
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-semibold text-gray-700 dark:text-gray-300">
          Market identity
        </legend>
        {Object.entries(labels).map(([key, label]) => (
          <label key={key} className="text-sm font-medium">
            {label}
            <input
              required
              aria-label={label}
              className={fieldClass}
              value={form[key as keyof typeof form]}
              disabled={key === 'code' && !!country && country.version > 0}
              aria-invalid={
                errors[key as keyof typeof form] ? true : undefined
              }
              onBlur={() => blur(key as keyof typeof form)}
              maxLength={key === 'name' ? 100 : undefined}
              onChange={(event) =>
                setForm({ ...form, [key]: event.target.value })
              }
            />
            <span
              aria-live="polite"
              className={errors[key as keyof typeof form] ? 'mt-1 block text-xs font-medium text-red-700 dark:text-red-300' : helperClass}
            >
              {errors[key as keyof typeof form] ||
                (key === 'timezones'
                  ? 'IANA names, e.g. Africa/Lagos'
                  : key === 'locale'
                    ? 'BCP 47 tag, e.g. en-NG'
                    : '')}
            </span>
          </label>
        ))}
      </fieldset>
      <fieldset disabled={busy} className="flex flex-wrap gap-4">
        <legend className="mb-2 text-sm font-medium">
          Available services after activation
        </legend>
        {(Object.keys(capabilities) as (keyof typeof capabilities)[]).map(
          (key) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4"
                checked={capabilities[key]}
                onChange={(event) =>
                  setCapabilities({
                    ...capabilities,
                    [key]: event.target.checked,
                  })
                }
              />
              {key === 'erm'
                ? 'ERM subscription'
                : key === 'storefront'
                  ? 'Merchant storefront'
                  : 'Marketplace'}
            </label>
          )
        )}
      </fieldset>
      <p className="max-w-2xl text-sm text-gray-600">
        Saving configuration deactivates this country and clears previous
        readiness reviews.
      </p>
      <button className={actionClass} disabled={busy || !canSave} type="submit">
        {country && country.version > 0
          ? 'Save configuration'
          : 'Create inactive country'}
      </button>
    </form>
  );
}

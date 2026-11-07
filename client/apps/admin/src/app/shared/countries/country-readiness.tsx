'use client';
import { useState } from 'react';
import {
  countryPrerequisites,
  type CountryConfiguration,
  type CountryPrerequisite,
} from '@/services/country.service';
import { actionClass, fieldClass } from './country-editor';
const labels: Record<CountryPrerequisite, string> = {
  legal: 'Legal terms',
  payments: 'Payment ownership and provider',
  fulfillment: 'Delivery and fulfillment',
  operations: 'Operations and recovery',
  merchantPolicy: 'Merchant eligibility policy',
};
export default function CountryReadiness({
  country,
  busy,
  canSave,
  review,
  activate,
}: {
  country: CountryConfiguration;
  busy: boolean;
  canSave: boolean;
  review: (prerequisite: CountryPrerequisite, evidence: string) => void;
  activate: (active: boolean) => void;
}) {
  const [prerequisite, setPrerequisite] =
    useState<CountryPrerequisite>('legal');
  const [evidence, setEvidence] = useState('');
  const ready = countryPrerequisites.every((key) => !!country.readiness?.[key]);
  return (
    <section
      className="space-y-4 border-t border-gray-200 pt-6"
      aria-labelledby="readiness-heading"
    >
      <div>
        <h2 id="readiness-heading" className="text-lg font-semibold">
          Launch readiness
        </h2>
        <p className="text-sm text-gray-600">
          Record an existing reviewed document or operational evidence reference
          for each prerequisite.
        </p>
      </div>
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {countryPrerequisites.map((key) => {
          const item = country.readiness?.[key];
          return (
            <li
              key={key}
              className="flex flex-wrap justify-between gap-2 py-2 text-sm"
            >
              <span>{labels[key]}</span>
              <span
                className={
                  item
                    ? 'font-medium text-green-700 dark:text-green-300'
                    : 'text-gray-500 dark:text-gray-400'
                }
              >
                {item
                  ? `Reviewed ${new Date(item.reviewedAt).toLocaleDateString()}`
                  : 'Not reviewed'}
              </span>
              {item && (
                <p className="w-full break-words text-xs text-gray-600 dark:text-gray-400">
                  {item.evidence}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          review(prerequisite, evidence);
        }}
        className="grid gap-3 sm:grid-cols-2"
      >
        <label className="text-sm font-medium">
          Prerequisite
          <select
            className={fieldClass}
            disabled={busy}
            value={prerequisite}
            onChange={(event) =>
              setPrerequisite(event.target.value as CountryPrerequisite)
            }
          >
            {countryPrerequisites.map((key) => (
              <option key={key} value={key}>
                {labels[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Evidence reference
          <input
            className={fieldClass}
            required
            minLength={5}
            maxLength={1000}
            disabled={busy}
            value={evidence}
            onChange={(event) => setEvidence(event.target.value)}
          />
        </label>
        <button
          className={`${actionClass} justify-self-start`}
          disabled={busy || !canSave || evidence.trim().length < 5}
        >
          Record readiness review
        </button>
      </form>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={actionClass}
          disabled={busy || !canSave || (!country.active && !ready)}
          onClick={() => activate(!country.active)}
        >
          {country.active ? 'Deactivate country' : 'Activate country'}
        </button>
        {!ready && (
          <p className="text-sm text-gray-600">
            All five reviews are required before activation.
          </p>
        )}
      </div>
    </section>
  );
}

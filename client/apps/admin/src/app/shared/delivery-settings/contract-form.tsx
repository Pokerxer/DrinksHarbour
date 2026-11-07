'use client';
import { useRef, useState, type FormEvent } from 'react';
import type {
  ConfigurationLocation,
  ReviewInput,
} from '@/services/delivery-settings.service';
import {
  BusySpinner,
  buttonClass,
  fieldClass,
  useUnsavedGuard,
} from '../market-foundation/workspace';
const numbers = [
  ['amountMinor', 'Accepted charge (kobo)', 0],
  ['maxUnits', 'Maximum units', 1],
  ['maxWeightGrams', 'Maximum weight (grams)', 1],
] as const;
const bounds = [
  ['minLat', 'Minimum latitude', -90, 90],
  ['maxLat', 'Maximum latitude', -90, 90],
  ['minLon', 'Minimum longitude', -180, 180],
  ['maxLon', 'Maximum longitude', -180, 180],
] as const;
const capabilityFields = [
  ['alcohol', 'Alcohol handling'],
  ['ageVerification', 'Age verification'],
  ['fragile', 'Fragile handling'],
] as const;
export default function ContractForm({
  location,
  version,
  busy,
  onSave,
}: {
  location: ConfigurationLocation;
  version: number;
  busy: boolean;
  onSave: (input: ReviewInput) => Promise<boolean>;
}) {
  const [proposal, setProposal] = useState<ReviewInput>(),
    [error, setError] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  useUnsavedGuard(
    !!proposal,
    'A confirmed review proposal is pending — discard or save it before leaving.'
  );
  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const data = new FormData(event.currentTarget),
      text = (key: string) => String(data.get(key) || '').trim(),
      num = (key: string) => Number(text(key));
    const capabilities = {
      alcohol: text('alcohol') === 'yes',
      ageVerification: text('ageVerification') === 'yes',
      fragile: text('fragile') === 'yes',
    };
    if (capabilities.alcohol && !capabilities.ageVerification) {
      setError('Alcohol handling requires reviewed age verification.');
      return;
    }
    if (num('minLat') >= num('maxLat') || num('minLon') >= num('maxLon')) {
      setError('Coverage minimums must be below maximums.');
      return;
    }
    const vehicles = data.getAll('vehicleTypes').map(String);
    if (!vehicles.length) {
      setError('Select at least one reviewed vehicle type.');
      return;
    }
    const validUntil = new Date(text('validUntil'));
    if (!Number.isFinite(validUntil.getTime()) || validUntil <= new Date()) {
      setError('Review expiry must be in the future.');
      return;
    }
    setProposal({
      tenant: location.tenant,
      location: location._id,
      version,
      currency: 'NGN',
      amountMinor: num('amountMinor'),
      maxUnits: num('maxUnits'),
      maxWeightGrams: num('maxWeightGrams'),
      vehicleTypes: vehicles,
      coverage: [
        {
          country: text('country'),
          state: text('state'),
          city: text('city'),
          minLat: num('minLat'),
          maxLat: num('maxLat'),
          minLon: num('minLon'),
          maxLon: num('maxLon'),
        },
      ],
      capabilities,
      reviewReference: text('reviewReference'),
      validUntil: validUntil.toISOString(),
    });
  }
  return (
    <section className="space-y-4 rounded-xl border border-muted p-4 sm:p-6">
      <h2 className="text-lg font-semibold">Review new delivery terms</h2>
      <p className="max-w-2xl text-sm leading-6 text-gray-600">
        Version {version}. Enter only terms supported by your review evidence.
        Accepted bookings retain their original terms and shipping budget.
      </p>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      <form ref={formRef} onSubmit={review}>
        <fieldset
          disabled={busy || !!proposal}
          className="grid gap-3 sm:grid-cols-2"
        >
          {numbers.map(([name, label, min]) => (
            <label key={name}>
              {label}
              <input
                className={fieldClass}
                name={name}
                type="number"
                min={min}
                max={Number.MAX_SAFE_INTEGER}
                step="1"
                required
              />
            </label>
          ))}
          <label>
            Valid until
            <input
              className={fieldClass}
              name="validUntil"
              type="datetime-local"
              required
            />
          </label>
          <label className="sm:col-span-2">
            Review evidence
            <textarea
              className={fieldClass}
              name="reviewReference"
              minLength={5}
              maxLength={500}
              required
            />
          </label>
          <fieldset className="sm:col-span-2">
            <legend>Reviewed vehicles</legend>
            <div className="flex flex-wrap gap-4">
              {['bike', 'tricycle', 'car', 'van', 'truck'].map((v) => (
                <label key={v}>
                  <input name="vehicleTypes" value={v} type="checkbox" /> {v}
                </label>
              ))}
            </div>
          </fieldset>
          {capabilityFields.map(([name, label]) => (
            <label key={name}>
              {label}
              <select
                aria-label={label}
                className={fieldClass}
                name={name}
                defaultValue=""
                required
              >
                <option value="" disabled>
                  Select reviewed capability
                </option>
                <option value="yes">Supported</option>
                <option value="no">Not supported</option>
              </select>
            </label>
          ))}
          <fieldset className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
            <legend>Reviewed coverage — Nigeria</legend>
            <label>
              Country
              <select
                aria-label="Country"
                className={fieldClass}
                name="country"
                defaultValue=""
                required
              >
                <option value="" disabled>
                  Select reviewed address format
                </option>
                <option value="Nigeria">Nigeria</option>
                <option value="NG">NG</option>
              </select>
            </label>
            {[
              ['state', 'State'],
              ['city', 'City'],
            ].map(([name, label]) => (
              <label key={name}>
                {label}
                <input
                  className={fieldClass}
                  name={name}
                  required
                  maxLength={100}
                />
              </label>
            ))}
            {bounds.map(([name, label, min, max]) => (
              <label key={name}>
                {label}
                <input
                  className={fieldClass}
                  name={name}
                  type="number"
                  step="any"
                  min={min}
                  max={max}
                  required
                />
              </label>
            ))}
          </fieldset>
          <button className={buttonClass} type="submit">
            Review exact terms
          </button>
        </fieldset>
      </form>
      {proposal && (
        <div
          className="mt-4 space-y-2 rounded-lg border border-muted bg-gray-50 p-4 dark:bg-gray-100/30"
          role="region"
          aria-label="Confirm review"
        >
          <h3 className="font-semibold">
            Confirm terms for {location.name} — version {proposal.version}
          </h3>
          <p className="text-sm tabular-nums">
            NGN {(proposal.amountMinor / 100).toFixed(2)} per dispatch; maximum{' '}
            {proposal.maxUnits} units / {proposal.maxWeightGrams} grams.
          </p>
          <p className="text-sm tabular-nums">Vehicles: {proposal.vehicleTypes.join(', ')}</p>
          <p className="text-sm">
            {proposal.coverage[0].city}, {proposal.coverage[0].state},{' '}
            {proposal.coverage[0].country}; latitude{' '}
            {proposal.coverage[0].minLat} to {proposal.coverage[0].maxLat};
            longitude {proposal.coverage[0].minLon} to{' '}
            {proposal.coverage[0].maxLon}
          </p>
          <p className="text-sm">
            {capabilityFields
              .map(
                ([key, label]) =>
                  `${label}: ${proposal.capabilities[key] ? 'supported' : 'not supported'}`
              )
              .join(' · ')}
          </p>
          <p className="text-sm tabular-nums">
            Expires {proposal.validUntil}. Evidence: {proposal.reviewReference}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              disabled={busy}
              className={buttonClass}
              onClick={async () => {
                if (await onSave(proposal)) {
                  setProposal(undefined);
                  formRef.current?.reset();
                }
              }}
            >
              {busy ? (
                <>
                  <BusySpinner /> Saving…
                </>
              ) : (
                'Confirm reviewed terms'
              )}
            </button>
            <button
              disabled={busy}
              className={buttonClass}
              onClick={() => setProposal(undefined)}
            >
              Edit terms
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import * as Icon from 'react-icons/pi';
import AddressAutocomplete from '@core/components/google-map/delivery-address-autocomplete';
import LocationPickerMap from '@core/components/google-map/delivery-location-map';
import type useDeliveryQuote from './use-delivery-quote';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface DeliveryDraft {
  address: string;
  lga: string;
  state: string;
  zipCode: string;
  country: string;
  pin?: { lat: number; lon: number; manual?: boolean };
  feeOverride?: string;
}

// The labels the server's normaliseState() canonicalises (FCT variants fold to
// "FCT - Abuja") and the keys STATE_ZONES/LGA_OVERRIDES are built from.
const STATES = [
  'Abia',
  'Adamawa',
  'Akwa Ibom',
  'Anambra',
  'Bauchi',
  'Bayelsa',
  'Benue',
  'Borno',
  'Cross River',
  'Delta',
  'Ebonyi',
  'Edo',
  'Ekiti',
  'Enugu',
  'FCT - Abuja',
  'Gombe',
  'Imo',
  'Jigawa',
  'Kaduna',
  'Kano',
  'Katsina',
  'Kebbi',
  'Kogi',
  'Kwara',
  'Lagos',
  'Nasarawa',
  'Niger',
  'Ogun',
  'Ondo',
  'Osun',
  'Oyo',
  'Plateau',
  'Rivers',
  'Sokoto',
  'Taraba',
  'Yobe',
  'Zamfara',
];

export default function DeliveryCard({
  value,
  onChange,
  quote,
  savedAddresses,
}: {
  value: DeliveryDraft;
  onChange: (value: DeliveryDraft) => void;
  quote: ReturnType<typeof useDeliveryQuote>;
  savedAddresses?: React.ReactNode;
}) {
  const [lgas, setLgas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  // GET /api/shipping/lgas is public: `{ success, data: string[] }`.
  useEffect(() => {
    setLgas([]);
    if (!value.state) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    fetch(
      `${API_URL}/api/shipping/lgas?state=${encodeURIComponent(value.state)}`,
      { signal: controller.signal }
    )
      .then((r) => r.json() as Promise<{ success?: boolean; data?: string[] }>)
      .then((d) => {
        if (!controller.signal.aborted)
          setLgas(d.success ? (d.data ?? []) : []);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [value.state]);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-4">
        <h3 className="flex items-center gap-2 text-sm font-black text-gray-900">
          <Icon.PiTruckBold size={16} className="text-red-700" /> Delivery
          address
        </h3>
      </div>
      <div className="space-y-4 p-5">
        {savedAddresses}
        <AddressAutocomplete
          apiUrl={API_URL}
          value={value.address}
          label="Street address"
          placeholder="Search for the customer’s street or landmark"
          onChange={(address, details) => {
            const match = details?.state?.trim().replace(/ state$/i, '');
            const state =
              match &&
              (/^(federal capital territory|abuja|fct)$/i.test(match)
                ? 'FCT - Abuja'
                : STATES.find((s) => s.toLowerCase() === match.toLowerCase()));
            onChange({
              ...value,
              address,
              ...(state && state !== value.state ? { state, lga: '' } : {}),
              pin: details
                ? { lat: details.lat, lon: details.lon }
                : value.pin?.manual
                  ? value.pin
                  : undefined,
              zipCode: details?.postcode || value.zipCode,
            });
            if (details) setMapOpen(true);
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            aria-expanded={mapOpen}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            onClick={() => setMapOpen((open) => !open)}
          >
            <Icon.PiMapPin aria-hidden />{' '}
            {mapOpen ? 'Hide delivery map' : 'Show delivery map'}
          </button>
          {value.pin && (
            <span className="text-xs text-gray-500">
              Customer location pinned
            </span>
          )}
          {value.pin && (
            <button
              type="button"
              className="text-xs font-medium text-brand"
              onClick={() => onChange({ ...value, pin: undefined })}
            >
              Clear pin
            </button>
          )}
        </div>
        {mapOpen && (
          <LocationPickerMap
            apiUrl={API_URL}
            lat={value.pin?.lat ?? null}
            lon={value.pin?.lon ?? null}
            allowGeolocation={false}
            onPinChange={(lat, lon) =>
              onChange({ ...value, pin: { lat, lon, manual: true } })
            }
          />
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label
              htmlFor="wa-delivery-state"
              className="mb-1.5 block text-xs font-semibold text-gray-600"
            >
              State
            </label>
            <select
              id="wa-delivery-state"
              value={value.state}
              onChange={(e) =>
                onChange({
                  ...value,
                  state: e.target.value,
                  lga: '',
                })
              }
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:bg-white"
            >
              <option value="">Select state…</option>
              {STATES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="wa-delivery-lga"
              className="mb-1.5 block text-xs font-semibold text-gray-600"
            >
              LGA
            </label>
            <select
              id="wa-delivery-lga"
              value={value.lga}
              disabled={!value.state || loading}
              onChange={(e) => onChange({ ...value, lga: e.target.value })}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:bg-white disabled:opacity-50"
            >
              <option value="">{loading ? 'Loading…' : 'Select LGA…'}</option>
              {lgas.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">
              Postal code (optional)
            </label>
            <input
              value={value.zipCode}
              onChange={(e) => onChange({ ...value, zipCode: e.target.value })}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:bg-white"
            />
          </div>
        </div>
        <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-gray-900">
              Delivery fee
            </h4>
            {value.feeOverride === undefined ? (
              <button
                type="button"
                className="text-xs font-semibold text-brand"
                onClick={() =>
                  onChange({
                    ...value,
                    feeOverride:
                      quote.baseFee === null ? '' : String(quote.baseFee),
                  })
                }
              >
                Edit delivery fee
              </button>
            ) : (
              <button
                type="button"
                className="text-xs font-semibold text-brand"
                onClick={() => onChange({ ...value, feeOverride: undefined })}
              >
                Use calculated fee
              </button>
            )}
          </div>
          <p role="status" className="text-xs text-gray-600">
            {quote.loading ? (
              'Calculating delivery…'
            ) : quote.failed ? (
              'Delivery quote unavailable.'
            ) : quote.baseFee !== null ? (
              <>
                Calculated ₦{quote.baseFee.toLocaleString()} ·{' '}
                {quote.info?.source === 'google'
                  ? quote.info.distanceKm == null
                    ? 'Road distance rate'
                    : `${quote.info.distanceKm.toLocaleString()} km by road`
                  : 'State and LGA rate'}
              </>
            ) : (
              'Select a state and LGA and add a product to calculate delivery.'
            )}
          </p>
          {quote.failed && (
            <button
              type="button"
              className="text-xs font-semibold text-brand"
              onClick={quote.retry}
            >
              Retry calculation
            </button>
          )}
          {value.feeOverride !== undefined && (
            <label className="flex max-w-xs flex-col gap-1 text-xs font-medium text-gray-700">
              Manual delivery fee (₦)
              <input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={value.feeOverride}
                aria-invalid={!quote.hasFee}
                onChange={(event) =>
                  onChange({ ...value, feeOverride: event.target.value })
                }
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              />
              <span className="font-normal text-gray-500">
                Enter 0 for free delivery.
              </span>
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

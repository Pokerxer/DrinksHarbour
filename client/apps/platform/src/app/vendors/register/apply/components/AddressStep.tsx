'use client';

import React, { useState } from 'react';
import * as Icon from 'react-icons/pi';
import AddressAutocomplete from '@/components/AddressAutocomplete/AddressAutocomplete';
import LocationPickerMap from '@/components/LocationPickerMap/LocationPickerMap';
import type { AddressDetails } from '@/components/AddressAutocomplete/AddressAutocomplete';
import type { FormData } from './ApplyForm';
import { StepHeader, InfoNote } from './step-ui';

export function AddressStep({
  form,
  update,
  errors,
}: {
  form: FormData;
  update: <K extends keyof FormData>(key: K, value: FormData[K]) => void;
  errors: Partial<Record<keyof FormData, string>>;
}) {
  const [addressText, setAddressText] = useState(form.addressFormatted || '');

  function handleAddressSelect(address: string, details?: AddressDetails) {
    setAddressText(address);
    update('addressFormatted', address);
    if (details) {
      update('addressLat', details.lat);
      update('addressLon', details.lon);
      update('city', details.city || '');
      update('state', details.state || '');
      update('postcode', details.postcode || '');
    }
  }

  function handleMapLocationChange(details: AddressDetails) {
    update('addressFormatted', details.formatted);
    update('addressLat', details.lat);
    update('addressLon', details.lon);
    update('city', details.city || '');
    update('state', details.state || '');
    update('postcode', details.postcode || '');
    setAddressText(details.formatted);
  }

  const hasCoords = form.addressLat && form.addressLon;

  return (
    <div className="space-y-5">
      <StepHeader
        title="Where is your business?"
        subtitle="Search for your address or pin it on the map. We use this for delivery logistics and to show buyers your location."
      />

      {/* Address autocomplete */}
      <div>
        <AddressAutocomplete
          value={addressText}
          onChange={handleAddressSelect}
          onBestMatch={(details) => {
            if (details && !form.addressFormatted) {
              update('addressLat', details.lat);
              update('addressLon', details.lon);
              update('city', details.city || '');
              update('state', details.state || '');
            }
          }}
          error={errors.addressFormatted}
          placeholder="Search your business address…"
          label="Business address"
        />
      </div>

      {/* Map picker */}
      <div>
        <LocationPickerMap
          lat={form.addressLat || null}
          lon={form.addressLon || null}
          onLocationChange={handleMapLocationChange}
        />
      </div>

      {/* Auto-filled summary */}
      {hasCoords ? (
        <div className="bg-emerald-50 rounded-xl px-4 py-3 space-y-2">
          <div className="flex items-center gap-1.5 text-emerald-700">
            <Icon.PiCheckCircleBold size={14} />
            <span className="text-xs font-semibold">Location confirmed</span>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div className="flex items-center gap-1.5">
              <Icon.PiMapPinBold size={11} className="text-emerald-500" />
              <dt className="text-gray-400">City:</dt>
              <dd className="text-gray-700 font-semibold">{form.city || '—'}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <Icon.PiFlagBold size={11} className="text-emerald-500" />
              <dt className="text-gray-400">State:</dt>
              <dd className="text-gray-700 font-semibold">{form.state || '—'}</dd>
            </div>
            {form.postcode && (
              <div className="flex items-center gap-1.5">
                <Icon.PiEnvelopeSimple size={11} className="text-emerald-500" />
                <dt className="text-gray-400">Postcode:</dt>
                <dd className="text-gray-700 font-semibold">{form.postcode}</dd>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Icon.PiCrosshair size={11} className="text-emerald-500" />
              <dt className="text-gray-400">Coords:</dt>
              <dd className="text-gray-700 font-mono text-[11px]">
                {form.addressLat?.toFixed(4)}, {form.addressLon?.toFixed(4)}
              </dd>
            </div>
          </dl>
        </div>
      ) : (
        <InfoNote icon={Icon.PiInfoBold} color="amber">
          Search for your address above, then drag the pin on the map to your exact location.
          This ensures accurate delivery routing.
        </InfoNote>
      )}
    </div>
  );
}
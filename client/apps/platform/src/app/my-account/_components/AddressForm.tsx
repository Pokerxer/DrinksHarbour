'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import * as Icon from 'react-icons/pi';
import type { AddressFormData } from '../_types';
import { NG_STATES, inputCls, labelCls } from '../_constants';
import AddressAutocomplete, { type AddressDetails } from '@/components/AddressAutocomplete/AddressAutocomplete';
import LocationPickerMap from '@/components/LocationPickerMap/LocationPickerMap';
import { API_URL } from '@/lib/api';

interface Props {
  form: AddressFormData;
  onChange: (data: AddressFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  saving: boolean;
  editing: boolean;
}

const up = (prev: AddressFormData, patch: Partial<AddressFormData>) => ({ ...prev, ...patch });

// Match a raw Google state string to our NG_STATES list
function matchState(raw: string): string {
  if (!raw) return '';
  if (/federal capital territory|abuja/i.test(raw)) return 'FCT Abuja';
  const stripped = raw.replace(/\s+state$/i, '').trim();
  return (
    NG_STATES.find(n => n.toLowerCase() === raw.toLowerCase()) ||
    NG_STATES.find(n => n.toLowerCase() === stripped.toLowerCase()) ||
    NG_STATES.find(n => n.toLowerCase().includes(stripped.toLowerCase())) ||
    raw
  );
}

export default function AddressForm({ form, onChange, onSubmit, onCancel, saving, editing }: Props) {
  const [lgaList,    setLgaList]    = useState<string[]>([]);
  const [lgaLoading, setLgaLoading] = useState(false);
  const [addressDetails, setAddressDetails] = useState<AddressDetails | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch LGA list whenever state changes
  useEffect(() => {
    if (!form.state) { setLgaList([]); return; }
    setLgaLoading(true);
    const apiState = /^fct/i.test(form.state) ? 'Federal Capital Territory' : form.state;
    fetch(`${API_URL}/api/shipping/lgas?state=${encodeURIComponent(apiState)}`)
      .then(r => r.json())
      .then(d => setLgaList(d.success ? d.data : []))
      .catch(() => setLgaList([]))
      .finally(() => setLgaLoading(false));
  }, [form.state]);

  // When editing, pre-load LGA list for the saved state
  // (handled by the effect above on mount)

  const handleAddressSelect = (address: string, details?: AddressDetails) => {
    const patch: Partial<AddressFormData> = { address };
    if (details) {
      setAddressDetails(details);
      if (details.state) patch.state = matchState(details.state);
      if (details.postcode) patch.coordinates = undefined; // will be set below
      patch.coordinates = { lat: details.lat, lng: details.lon };
    }
    // Reset LGA when address changes so user picks fresh
    patch.lga = '';
    onChange(up(form, patch));
  };

  const handleBestMatch = useCallback((details: AddressDetails | null) => {
    setAddressDetails(details);
    if (details) {
      onChange(up(form, { coordinates: { lat: details.lat, lng: details.lon } }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  const handleMapChange = useCallback((details: AddressDetails) => {
    setAddressDetails(details);
    const patch: Partial<AddressFormData> = {
      coordinates: { lat: details.lat, lng: details.lon },
      address: details.formatted || details.street || form.address,
    };
    if (details.state) patch.state = matchState(details.state);
    onChange(up(form, patch));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-white rounded-xl border border-stone-100 shadow-sm overflow-hidden"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
        <h2 className="font-black text-stone-900 text-sm flex items-center gap-2">
          <Icon.PiMapPinBold size={15} className="text-red-700" />
          {editing ? 'Edit Address' : 'Add New Address'}
        </h2>
        <button onClick={onCancel} className="text-stone-400 hover:text-stone-600 transition-all">
          <Icon.PiXBold size={16} />
        </button>
      </div>

      <form onSubmit={onSubmit} className="p-6 space-y-4">

        {/* Label + Default toggle */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Label</label>
            <select
              value={form.label}
              onChange={e => onChange(up(form, { label: e.target.value }))}
              className={inputCls}
            >
              <option>Home</option>
              <option>Work</option>
              <option>Other</option>
            </select>
          </div>
          <div className="flex items-end pb-2.5">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={e => onChange(up(form, { isDefault: e.target.checked }))}
                className="w-4 h-4 rounded accent-red-700"
              />
              <span className="text-sm font-medium text-stone-700">Set as default address</span>
            </label>
          </div>
        </div>

        {/* Name fields */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>First Name</label>
            <input
              required
              value={form.firstName}
              onChange={e => onChange(up(form, { firstName: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Last Name</label>
            <input
              required
              value={form.lastName}
              onChange={e => onChange(up(form, { lastName: e.target.value }))}
              className={inputCls}
            />
          </div>
        </div>

        {/* Phone */}
        <div>
          <label className={labelCls}>Phone Number</label>
          <input
            type="tel"
            required
            placeholder="+234 800 000 0000"
            value={form.phone}
            onChange={e => onChange(up(form, { phone: e.target.value }))}
            className={inputCls}
          />
        </div>

        {/* Google Maps address autocomplete */}
        <AddressAutocomplete
          value={form.address}
          onChange={handleAddressSelect}
          onBestMatch={handleBestMatch}
          onClearError={() => {}}
          label="Street Address"
          placeholder="Start typing your street, estate or landmark…"
          required
        />

        {/* Map pin */}
        <LocationPickerMap
          lat={addressDetails?.lat ?? null}
          lon={addressDetails?.lon ?? null}
          onLocationChange={handleMapChange}
        />

        {/* Optional line 2 + landmark */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>
              Apartment / Suite <span className="text-stone-400 font-normal">(optional)</span>
            </label>
            <input
              placeholder="Flat 3B, Block A…"
              value={form.addressLine2 || ''}
              onChange={e => onChange(up(form, { addressLine2: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              Landmark <span className="text-stone-400 font-normal">(optional)</span>
            </label>
            <input
              placeholder="Near Shoprite, opposite bank…"
              value={form.landmark || ''}
              onChange={e => onChange(up(form, { landmark: e.target.value }))}
              className={inputCls}
            />
          </div>
        </div>

        {/* State + LGA */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>State <span className="text-red-500">*</span></label>
            <select
              required
              value={form.state}
              onChange={e => onChange(up(form, { state: e.target.value, lga: '' }))}
              className={inputCls}
            >
              <option value="">Select state…</option>
              {NG_STATES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>
              Local Government Area (LGA) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                required
                disabled={!form.state || lgaLoading}
                value={form.lga}
                onChange={e => onChange(up(form, { lga: e.target.value }))}
                className={`${inputCls} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <option value="">
                  {lgaLoading ? 'Loading…' : !form.state ? 'Select state first' : 'Select LGA…'}
                </option>
                {lgaList.map(l => <option key={l}>{l}</option>)}
              </select>
              {lgaLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <div className="w-3.5 h-3.5 border-2 border-stone-200 border-t-stone-500 rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-800 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-900 transition-all disabled:opacity-60"
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              <>{editing ? 'Update Address' : 'Save Address'}</>
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 border border-stone-200 rounded-xl text-sm font-semibold text-stone-600 hover:border-red-200 hover:text-red-700 transition-all"
          >
            Cancel
          </button>
        </div>
      </form>
    </motion.div>
  );
}

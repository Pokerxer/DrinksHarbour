'use client';

import React, { useEffect, useState } from 'react';
import * as Icon from 'react-icons/pi';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface DeliveryDraft { address: string; lga: string; state: string; zipCode: string; country: string; }

// The labels the server's normaliseState() canonicalises (FCT variants fold to
// "FCT - Abuja") and the keys STATE_ZONES/LGA_OVERRIDES are built from.
const STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT - Abuja','Gombe','Imo','Jigawa',
  'Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo',
  'Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];

export default function DeliveryCard({ value, onChange, subtotal, onFee, token }: {
  value: DeliveryDraft; onChange: (v: DeliveryDraft) => void; subtotal: number;
  onFee: (fee: number) => void; token: string;
}) {
  const [lgas, setLgas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [feeLoading, setFeeLoading] = useState(false);
  const [fee, setFee] = useState<{ fee: number; label: string } | null>(null);

  // GET /api/shipping/lgas is public: `{ success, data: string[] }`.
  useEffect(() => {
    if (!value.state) { setLgas([]); return; }
    setLoading(true);
    fetch(`${API_URL}/api/shipping/lgas?state=${encodeURIComponent(value.state)}`)
      .then(r => r.json() as Promise<{ success?: boolean; data?: string[] }>)
      .then(d => setLgas((d.success ? d.data : []) || []))
      .catch(() => setLgas([])).finally(() => setLoading(false));
  }, [value.state]);

  // Live fee quote — same endpoint the storefront checkout uses. Optional-auth
  // (guest quoting works); the JWT lets the server apply the first-order perk.
  // Response data: { fee, zone, label, deliveryDaysMin/Max, isFree, … }.
  useEffect(() => {
    if (!value.state || !value.lga || subtotal <= 0) { setFee(null); onFee(0); return; }
    setFeeLoading(true);
    const params = new URLSearchParams({ state: value.state, lga: value.lga, subtotal: String(subtotal) });
    fetch(`${API_URL}/api/shipping/calculate?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json() as Promise<{ success?: boolean; data?: { fee?: number; label?: string } }>)
      .then(d => {
        if (d.success && d.data) { setFee({ fee: d.data.fee ?? 0, label: d.data.label ?? '' }); onFee(d.data.fee ?? 0); }
      })
      .catch(() => {})
      .finally(() => setFeeLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.state, value.lga, subtotal]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-black text-gray-900 flex items-center gap-2"><Icon.PiTruckBold size={16} className="text-red-700" /> Delivery address</h3>
      </div>
      <div className="p-5 space-y-4">
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Street address</label>
          <textarea value={value.address} onChange={e => onChange({ ...value, address: e.target.value })} rows={2}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:border-red-400 outline-none" />
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">State</label>
            <select value={value.state} onChange={e => onChange({ ...value, state: e.target.value, lga: '' })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white outline-none">
              <option value="">Select state…</option>
              {STATES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">LGA</label>
            <select value={value.lga} disabled={!value.state || loading}
              onChange={e => onChange({ ...value, lga: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white outline-none disabled:opacity-50">
              <option value="">{loading ? 'Loading…' : 'Select LGA…'}</option>
              {lgas.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Postal code (optional)</label>
            <input value={value.zipCode} onChange={e => onChange({ ...value, zipCode: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white outline-none" />
          </div>
        </div>
        <div className="text-xs flex items-center gap-2">
          <Icon.PiLightningBold size={12} className="text-blue-500" />
          {feeLoading ? <span className="text-blue-500">Calculating delivery fee…</span>
            : fee ? <span className="text-gray-600">Delivery: <strong>₦{fee.fee.toLocaleString()}</strong> ({fee.label})</span>
            : <span className="text-gray-400">Select state + LGA for the delivery fee</span>}
        </div>
      </div>
    </div>
  );
}

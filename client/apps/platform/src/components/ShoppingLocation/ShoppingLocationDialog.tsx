'use client';
import React, { useEffect, useRef, useState } from 'react';
import { PiMapPin, PiCrosshair, PiCheck, PiX, PiArrowClockwise } from 'react-icons/pi';
import AddressAutocomplete from '@/components/AddressAutocomplete/AddressAutocomplete';
import { useShoppingLocation } from '@/context/ShoppingLocationContext';
import { useLocationDraft } from './useLocationDraft';

export default function ShoppingLocationDialog({ onClose }: { onClose: () => void }) {
  const { addresses, location, accountKey, addressesLoading, addressError, retryAddresses, applyLocation } = useShoppingLocation();
  const { draft, setDraft, locating, locationError, locate } = useLocationDraft(location, accountKey);
  const [browseWithout, setBrowseWithout] = useState(false);
  const [text, setText] = useState('');
  const [applyError, setApplyError] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const selected = (lat: number, lon: number) => draft?.lat === lat && draft?.lon === lon;
  const canApply = !locating && (!!draft || (browseWithout && !text.trim()));
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => { before?.focus(); };
  }, []);
  useEffect(() => { setText(''); setApplyError(null); setBrowseWithout(false); }, [accountKey]);
  return <dialog ref={dialog} onCancel={onClose} onClose={onClose} aria-labelledby="shopping-location-title"
    aria-describedby="shopping-location-description"
    className="open:flex flex-col fixed inset-x-0 bottom-0 top-auto m-0 w-full max-w-none max-h-[90dvh] rounded-t-3xl border-0 p-0 text-zinc-900 bg-white shadow-2xl backdrop:bg-black/50 sm:inset-0 sm:m-auto sm:w-[min(92vw,520px)] sm:rounded-2xl sm:h-fit">
    <div className="flex items-start gap-3 px-5 pt-5 pb-4 sm:px-6 border-b border-zinc-100">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-[#b20202]"><PiMapPin size={24} aria-hidden /></span>
      <div className="flex-1">
        <h2 id="shopping-location-title" className="text-lg font-semibold tracking-tight">Find drinks near you</h2>
        <p id="shopping-location-description" className="text-sm text-zinc-500 mt-1">Choose where you’re shopping. Nearby sellers appear first.</p>
      </div>
      <button onClick={onClose} aria-label="Close location selection" className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b20202]"><PiX size={20} /></button>
    </div>
    <div className="overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 space-y-5">
      <button onClick={() => { setText(''); setBrowseWithout(false); void locate(); }} disabled={locating}
        className="flex w-full items-center gap-3 rounded-xl border border-zinc-200 px-4 py-3.5 text-left hover:border-[#b20202] hover:bg-red-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b20202] disabled:opacity-60">
        <PiCrosshair size={22} className="text-[#b20202]" aria-hidden />
        <span><span className="block font-semibold text-sm">{locating ? 'Finding your location…' : 'Use current location'}</span>
          <span className="block text-xs text-zinc-500 mt-0.5">Your browser will ask for location access</span></span>
      </button>
      {locating && <p role="status" className="text-sm text-zinc-500">Finding nearby sellers for your current location…</p>}
      {locationError && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
        <p>{locationError}</p>
        <button onClick={() => void locate()} className="mt-2 inline-flex items-center gap-1 font-semibold underline"><PiArrowClockwise aria-hidden />Try location again</button>
      </div>}
      {(addresses.length > 0 || addressesLoading || addressError) && <section aria-label="Saved delivery addresses">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Saved addresses</h3>
        {addressesLoading && <p role="status" className="text-sm text-zinc-500 py-2">Loading saved addresses…</p>}
        {addressError && <div className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600">
          <p>{addressError}</p><button onClick={retryAddresses} className="mt-2 font-semibold text-[#b20202] underline">Retry saved addresses</button>
        </div>}
        <div className="space-y-2">{addresses.map(address => <button key={address.addressId}
          aria-pressed={selected(address.lat, address.lon)}
          className={'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b20202] ' +
            (selected(address.lat, address.lon) ? 'border-[#b20202] bg-red-50/50' : 'border-zinc-200 hover:border-zinc-400')}
          onClick={() => { setText(''); setBrowseWithout(false); setDraft(address); }}>
          <PiMapPin size={18} className="shrink-0 text-zinc-500" aria-hidden />
          <span className="flex-1 text-sm font-medium">{address.label}</span>
          {selected(address.lat, address.lon) && <PiCheck className="text-[#b20202] shrink-0" size={20} aria-hidden />}
        </button>)}</div>
      </section>}
      <div>
        <AddressAutocomplete value={text} onChange={(value, details) => {
          setText(value); setApplyError(null); setBrowseWithout(false);
          setDraft(details ? { lat: details.lat, lon: details.lon, label: details.formatted, source: 'delivery' } : null);
        }} label="Search delivery address" placeholder="Street, area or city" />
        <p className="text-xs text-zinc-500 mt-2">Select an address from the suggestions, then apply it.</p>
      </div>
      {draft && <div className="rounded-xl bg-zinc-50 border border-zinc-100 p-4" role="status">
        <p className="text-xs font-medium text-zinc-500">{draft.source === 'current' ? 'Current location selected' : 'Selected delivery address'}</p>
        <p className="mt-1 text-sm font-semibold break-words">{draft.label}</p>
        {draft.source === 'current' && <p className="mt-2 text-xs text-zinc-500">You’ll confirm your full delivery address at checkout.</p>}
      </div>}
      <p className="text-xs text-zinc-500 leading-relaxed">Farther sellers stay available. Distances are approximate and aren’t delivery-time estimates.</p>
      {browseWithout && <p role="status" className="text-sm text-zinc-600">Location sorting will be turned off when you apply.</p>}
      {applyError && <p role="alert" className="text-sm text-red-700">{applyError}</p>}
    </div>
    <div className="mt-auto border-t border-zinc-100 bg-white px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
      <div className="flex gap-3">
        <button onClick={onClose} className="rounded-xl border border-zinc-200 px-5 py-3 text-sm font-semibold hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-[#b20202]">Cancel</button>
        <button disabled={!canApply} onClick={() => {
          if (applyLocation(draft)) onClose();
          else setApplyError('This address is no longer available. Please choose another.');
        }} className="flex-1 rounded-xl bg-[#b20202] px-5 py-3 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2">
          Apply location
        </button>
      </div>
      {(location || draft) && <button onClick={() => { setText(''); setBrowseWithout(true); setDraft(null); }}
        className="block mx-auto mt-3 text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-800">Browse without a location</button>}
    </div>
  </dialog>;
}

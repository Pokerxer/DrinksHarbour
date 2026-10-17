'use client';
import React, { useState } from 'react';
import { PiMapPin, PiMapPinFill, PiCaretDown } from 'react-icons/pi';
import { useShoppingLocation } from '@/context/ShoppingLocationContext';
import ShoppingLocationDialog from './ShoppingLocationDialog';
export default function ShoppingLocationControl({ compact = false }: { compact?: boolean }) {
  const { location } = useShoppingLocation();
  const [open, setOpen] = useState(false);
  if (compact) return <>
    <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}
      aria-label={location ? `Change shopping location: ${location.label}` : 'Choose your shopping location'}
      title={location?.label || 'Choose your location'}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-red-200 bg-red-50 text-[#b20202] shadow-sm hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b20202] focus-visible:ring-offset-2">
      <PiMapPinFill size={24} aria-hidden />
    </button>
    {open && <ShoppingLocationDialog onClose={() => setOpen(false)} />}
  </>;
  return <div className="border-t border-zinc-100 bg-white">
    <div className="container mx-auto px-4 py-2 flex items-center justify-between gap-4">
      <button onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}
        className="flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-1.5 -ml-2 text-left hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b20202] motion-reduce:transition-none">
        <PiMapPin className="shrink-0 text-[#b20202]" size={21} aria-hidden />
        <span className="min-w-0">
          <span className="block text-[10px] uppercase tracking-wider font-semibold text-zinc-500">{location?.source === 'current' ? 'Shopping near' : 'Delivery location'}</span>
          <span className="block truncate max-w-[70vw] sm:max-w-sm text-sm font-semibold text-zinc-800">{location?.label || 'Choose your location'}</span>
        </span>
        <PiCaretDown size={14} className="text-zinc-500 shrink-0" aria-hidden />
      </button>
      <span className="hidden sm:block text-xs text-zinc-500">{location ? 'Nearby sellers, more choice' : 'Find sellers closest to you'}</span>
    </div>
    {open && <ShoppingLocationDialog onClose={() => setOpen(false)} />}
  </div>;
}

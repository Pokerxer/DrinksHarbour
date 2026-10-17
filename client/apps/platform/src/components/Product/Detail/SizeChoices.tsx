'use client';
import {PiCheck,PiRuler} from 'react-icons/pi';
import {purchaseLimits} from './purchase-quantity';
import {resolvePackPricing} from 'commerce-core';
import type {VendorSize} from './detail-types';
export default function SizeChoices({sizes,selected,onSelect}:{sizes:VendorSize[];selected:string;onSelect:(size:string)=>void}) {
  if(!sizes.length)return null;
  return <section aria-label="Choose a size" className="rounded-2xl border border-zinc-200 p-4">
    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><PiRuler size={18} aria-hidden/>Choose a size</h3>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{sizes.map(size=>{
      const active=selected===size.size,bounds=purchaseLimits(size);
      const pack=resolvePackPricing({packUnitPrice:size.packUnitPrice,packThreshold:size.packThreshold,
        packSavingsPct:size.packSavingsPct,unitPrice:size.price,quantity:1,stock:bounds.max,
        maxOrderQuantity:bounds.max,onSale:!!size.discount});
      return <button type="button" key={size._id||size.size} disabled={!bounds.canBuy} aria-pressed={active}
        onClick={()=>onSelect(size.size)} className={`relative rounded-xl border-2 p-3 text-left focus-visible:ring-2 focus-visible:ring-[#b20202] ${active?'border-[#b20202] bg-red-50/50':'border-zinc-200 hover:border-zinc-400'} disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:opacity-50`}>
        <span className="block text-sm font-semibold">{size.displayName}</span>
        {!!size.volumeMl&&<span className="block text-xs text-zinc-500">{size.volumeMl} ml</span>}
        <span className="mt-1 block text-sm font-semibold text-zinc-900">{size.currencySymbol}{size.price.toLocaleString('en-NG',{maximumFractionDigits:0})}</span>
        <span className="mt-1 block text-xs text-zinc-500">{bounds.canBuy?`Up to ${bounds.max} per order${bounds.min>1?` · Min ${bounds.min}`:''}`:bounds.max>0?'Below minimum order':'Unavailable'}</span>
        {size.originalPrice>size.price&&bounds.canBuy&&<span className="block mt-1 text-xs text-red-700">{size.discount?.label||'Sale price'}</span>}
        {pack.hasPackPricing&&bounds.canBuy&&<span className="mt-1 block text-xs font-medium text-amber-700">{pack.packThreshold}+ at {size.currencySymbol}{pack.packUnitPrice?.toLocaleString('en-NG')} each</span>}
        {active&&<PiCheck className="absolute right-2 top-2 text-[#b20202]" size={14} aria-label="Selected"/>}
      </button>;
    })}</div>
  </section>;
}

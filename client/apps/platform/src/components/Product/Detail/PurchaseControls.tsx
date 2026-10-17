'use client';
import type {ReactNode} from 'react';
import {PiMinus,PiPlus,PiShoppingCart} from 'react-icons/pi';
import type {purchaseLimits} from './purchase-quantity';
export default function PurchaseControls({quantity,limits,blocked,adding,size,seller,currency,total,onChange,onAdd,children}: {
  quantity:number; limits:ReturnType<typeof purchaseLimits>; blocked?:boolean; adding:boolean;
  size?:string; seller?:string; currency:string; total:number;
  onChange:(change:number)=>void; onAdd:()=>void; children?:ReactNode;
}) {
  const disabled=blocked || adding || !limits.canBuy || quantity < limits.min || quantity > limits.max;
  return <section aria-label="Purchase this drink" className="sticky bottom-0 z-20 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:static pb-[max(1rem,env(safe-area-inset-bottom))]">
    <div className="mb-3 min-w-0">
      <p className="truncate text-sm font-semibold text-zinc-900">{size ? `${size}${seller ? ` · ${seller}` : ''}` : 'Choose a seller and size'}</p>
      <p role="status" className="mt-1 text-xs text-zinc-500">{blocked ? 'Refresh seller availability before ordering.' : limits.canBuy
        ? `Order ${limits.min}–${limits.max} items · Total ${currency}${total.toLocaleString('en-NG',{maximumFractionDigits:0})}`
        : limits.max > 0 ? 'Available stock cannot meet the minimum order. Choose another size or seller.' : 'This option is unavailable. Choose another size or seller.'}</p>
    </div>
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="flex items-center justify-between rounded-xl border border-zinc-200 sm:shrink-0">
        <button type="button" aria-label="Decrease quantity" onClick={()=>onChange(-1)} disabled={disabled || quantity<=limits.min}
          className="h-12 w-12 rounded-xl hover:bg-zinc-50 disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-[#b20202]"><PiMinus className="mx-auto"/></button>
        <output aria-label="Quantity" className="min-w-12 text-center font-semibold">{quantity}</output>
        <button type="button" aria-label="Increase quantity" onClick={()=>onChange(1)} disabled={disabled || quantity>=limits.max}
          className="h-12 w-12 rounded-xl hover:bg-zinc-50 disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-[#b20202]"><PiPlus className="mx-auto"/></button>
      </div>
      <button type="button" onClick={onAdd} disabled={disabled || adding} aria-busy={adding}
        className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#b20202] px-4 py-3 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2">
        <PiShoppingCart size={20} aria-hidden/>{adding ? 'Adding…' : disabled ? 'Currently unavailable' : `Add to cart · ${currency}${total.toLocaleString('en-NG',{maximumFractionDigits:0})}`}
      </button>
    </div>
    <div className="mt-3">{children}</div>
  </section>;
}

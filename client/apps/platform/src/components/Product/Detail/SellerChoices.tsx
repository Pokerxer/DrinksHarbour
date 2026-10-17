'use client';
import {PiCheck,PiStorefront} from 'react-icons/pi';
import Image from '@/components/UI/OptimizedImage';
import SellerProximity from '@/components/ShoppingLocation/SellerProximity';
import {purchaseLimits} from './purchase-quantity';
import type {PurchaseSize} from './purchase-quantity';
interface Seller {
  _id:string; tenant:{name:string;city?:string;country?:string;logo?:{url?:string}};
  distanceKm?:number|null; sizes?:PurchaseSize[];
}
export default function SellerChoices({sellers,selectedId,nearestId,locationOrder,onSelect}:{
  sellers:Seller[];selectedId?:string;nearestId?:string;locationOrder:boolean;onSelect:(id:string)=>void;
}) {
  if(!sellers.length) return <p role="status" className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">No seller is currently offering this drink.</p>;
  return <section aria-label="Choose your seller" className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><PiStorefront aria-hidden size={18}/>{sellers.length>1?'Choose your seller':'Sold by'}</h3>
    <div className="grid gap-2 sm:grid-cols-2">{sellers.map(seller=>{
      const active=selectedId===seller._id;
      const available=seller.sizes?.some(size=>purchaseLimits(size).canBuy);
      return <button key={seller._id} type="button" aria-pressed={active} onClick={()=>onSelect(seller._id)}
        className={`flex min-w-0 items-start gap-3 rounded-xl border-2 bg-white p-3 text-left focus-visible:ring-2 focus-visible:ring-[#b20202] ${active?'border-[#b20202]':'border-transparent hover:border-zinc-300'}`}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-red-50 text-sm font-semibold text-[#b20202]" aria-hidden>{seller.tenant.logo?.url
          ? <Image src={seller.tenant.logo.url} alt="" width={40} height={40} className="object-cover"/>
          : seller.tenant.name.slice(0,2).toUpperCase()}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-zinc-900">{seller.tenant.name}</span>
          <span className="block text-xs text-zinc-500">{[seller.tenant.city,seller.tenant.country].filter(Boolean).join(', ')}</span>
          {locationOrder&&<SellerProximity distanceKm={seller.distanceKm??null} nearest={nearestId===seller._id}/>}
          {!available&&<span className="block mt-1 text-xs text-red-700">Currently unavailable</span>}
        </span>
        {active&&<PiCheck className="shrink-0 text-[#b20202]" size={18} aria-label="Selected"/>}
      </button>;
    })}</div>
  </section>;
}

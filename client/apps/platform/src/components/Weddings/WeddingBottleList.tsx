'use client';

import { useState } from 'react';
import Link from 'next/link';
import { addBottle, bottleSummary, describeBottleList, validateBottleList, type BottleChoice, type BottleListItem } from '@/lib/weddingBottleList';
import BottleThumbnail from './BottleThumbnail';
import CatalogueBottleSearch from './CatalogueBottleSearch';

const inputClass = 'mt-1 min-h-11 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-[16px]';
export default function WeddingBottleList({ items, onChange, listLabel = 'wedding' }: { items: BottleListItem[]; onChange: (items: BottleListItem[]) => void; listLabel?: string }) {
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const listError = validateBottleList(items);
  function add(choice: BottleChoice) {
    const result = addBottle(items, choice);
    setError(result.error || '');
    if (!result.error) { onChange(result.items); setNotice(`${choice.name.trim()} added to your list.`); return true; }
    return false;
  }
  function update(id: string, patch: Partial<BottleListItem>) {
    setError(''); setNotice(''); onChange(items.map(item => item.id === id ? { ...item, ...patch } : item));
  }
  function download() {
    const text = describeBottleList(items); if (!text || listError) return;
    const url = URL.createObjectURL(new Blob([`DrinksHarbour ${listLabel} drinks list\n\n${text}\n\nPlanning list only. Confirm sizes, stock, prices and delivery before ordering.\n`], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `${listLabel}-drinks-list.txt`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section id="wedding-bottle-list" aria-labelledby="bottle-list-title" className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
    <h3 id="bottle-list-title" className="text-xl font-bold text-[#351014]">Build your bottle list</h3>
    <p className="mb-5 mt-2 text-sm leading-7 text-gray-600">Select catalogue bottles and adjust their quantities. You can include up to 20 different products. Check available sizes on the product page.</p>
    <CatalogueBottleSearch onAdd={add} />
    {error && <p role="alert" className="mt-3 text-xs leading-6 text-red-700">{error}</p>}
    <p role="status" aria-live="polite" className="mt-4 text-xs leading-6 text-[#7c1d1d]">{notice || bottleSummary(items)}</p>
    <div className="mt-4 space-y-4">{items.map((item, index) => <div key={item.id} data-bottle-row className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-start justify-between gap-4">{item.productId && <BottleThumbnail src={item.image} />}<p className="min-w-0 break-words text-sm font-bold">{index + 1}. {item.name || 'Catalogue bottle'}</p><button type="button" aria-label={`Remove ${item.name || 'catalogue bottle'}`} onClick={() => { onChange(items.filter(row => row.id !== item.id)); setNotice('Bottle removed.'); setError(''); }} className="min-h-9 shrink-0 text-xs font-semibold text-[#7c1d1d] underline">Remove</button></div>
      {item.productId && <Link href={`/product/${encodeURIComponent(item.slug || '')}`} className="text-xs text-[#7c1d1d] underline">Catalogue bottle · view offers</Link>}
      <label className="mt-3 block text-xs font-medium">Quantity (bottles)<input id={`${item.id}-quantity`} aria-label={`Quantity for ${item.name}`} type="number" inputMode="numeric" min={1} max={9999} step={1} value={item.quantity} onChange={event => update(item.id, { quantity: event.target.value })} aria-invalid={!/^\d+$/.test(item.quantity) || Number(item.quantity) < 1 || Number(item.quantity) > 9999 || undefined} className={inputClass} /></label>
    </div>)}</div>
    {listError && <p role="alert" className="mt-3 text-xs leading-6 text-red-700">{listError}</p>}
    {!items.length && <div className="mt-4 rounded-xl border border-dashed border-[#7c1d1d]/25 bg-[#fff8ec] p-4" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(53,16,20,0.05) 0px, rgba(53,16,20,0.05) 1px, transparent 1px, transparent 8px)' }}><p className="text-xs font-bold uppercase tracking-wider text-[#7c1d1d]">Your list is empty</p><p className="mt-1 text-xs leading-6 text-gray-600">Search the catalogue above, tick drink categories, or attach your own list below so our team knows what to check.</p></div>}
    {items.length > 0 && <div className="mt-5 border-t border-gray-200 pt-4"><p className="text-sm font-semibold">{bottleSummary(items)}</p><button type="button" onClick={download} disabled={Boolean(listError)} className="mt-3 min-h-11 rounded-full border border-rose-200 px-4 py-2 text-xs font-bold text-[#7c1d1d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d] disabled:opacity-50">Download bottle list</button></div>}
    <p className="mt-4 text-[11px] leading-6 text-gray-500">This list stays on this page until you leave or clear it. Download a copy to keep it. Prices, available sizes, stock and delivery need confirmation on the product page.</p>
  </section>;
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import BottleThumbnail from '@/components/Weddings/BottleThumbnail';
import { useTenant } from '@/context/TenantContext';
import { publicBottleChoices, type BottleChoice } from '@/lib/weddingBottleList';

type Props = {
  label: string;
  category?: string;
  type?: string;
  query?: string;
  limit?: number;
  emptyHint?: string;
  onAdd?: (bottle: BottleChoice) => boolean | void;
};

/**
 * Real catalogue bottles for an occasion. Client fetch through the existing
 * public search endpoint; display-only unless an onAdd handler is passed.
 */
export default function OccasionShelf({ label, category, type, query, limit = 6, emptyHint, onAdd }: Props) {
  const { tenant } = useTenant();
  const tenantId = tenant?._id;
  const [choices, setChoices] = useState<BottleChoice[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [attempt, setAttempt] = useState(0);

  // The search endpoint is text-driven; a human label like "Whisky for client
  // gifts" matches nothing. Fall back to the category the shelf was given.
  const searchTerm = query || category || type || label;

  const load = useCallback(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ q: searchTerm, limit: String(limit), inStock: 'true', fields: 'card', searchMode: 'text' });
    if (category) params.set('category', category);
    if (type) params.set('type', type);
    if (tenantId) params.set('tenantId', tenantId);
    setStatus('loading');
    const deadline = setTimeout(() => controller.abort(), 12000);
    fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/products/search?${params}`, { signal: controller.signal, cache: 'no-store', credentials: 'omit' })
      .then(async response => { if (!response.ok) throw new Error('Search unavailable'); return publicBottleChoices(await response.json(), limit); })
      .then(result => { setChoices(result); setStatus('ready'); })
      .catch(() => { if (!controller.signal.aborted) { setChoices([]); setStatus('error'); } })
      .finally(() => clearTimeout(deadline));
    return () => { clearTimeout(deadline); controller.abort(); };
    // attempt changes trigger an explicit retry below.
  }, [category, searchTerm, limit, tenantId, type, attempt]);

  useEffect(() => load(), [load]);

  return <section className="rounded-2xl border border-gray-200 bg-white p-6" aria-label={label}>
    <h3 className="text-xl font-bold text-gray-900">{label}</h3>
    {status === 'loading' && <p className="mt-1 text-xs text-gray-500">Loading bottle suggestions…</p>}
    {status === 'error' && <p className="mt-3 text-sm text-gray-600">{emptyHint || 'Bottles could not load right now. Browse the shop or ask support for current availability.'}</p>}
    {status === 'error' && <button type="button" onClick={() => setAttempt(current => current + 1)} className="mt-3 inline-flex min-h-10 items-center rounded-full border bg-white border-rose-200 px-4 py-2 text-xs font-semibold text-[#7c1d1d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d] hover:border-[#7c1d1d] hover:bg-[#fff8ec]">Try again</button>}
    <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {status === 'loading' && Array.from({ length: 3 }).map((_, index) => (
        <li key={index} className="h-24 animate-pulse rounded-xl bg-gray-100" data-shelf-skeleton aria-hidden="true" />
      ))}
      {status !== 'loading' && choices.map(choice => <li key={choice.productId} className="flex items-center gap-3 rounded-xl border border-gray-100 p-3">
        <BottleThumbnail src={choice.image} />
        <div className="min-w-0 flex-1">
          <Link href={`/product/${choice.slug}`} className="block truncate text-sm font-semibold text-[#7c1d1d] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{choice.name}</Link>
          {onAdd && <button type="button" onClick={() => { if (onAdd(choice) === false) return; }} className="mt-1 inline-flex min-h-9 items-center rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-[#7c1d1d] hover:border-[#7c1d1d]" aria-label={`Add ${choice.name} to your list`}>Add to list</button>}
        </div>
      </li>)}
    </ul>
    {status === 'ready' && !choices.length && <p className="mt-3 text-sm text-gray-600">{emptyHint || 'No bottles matched just now. Browse the shop or ask support about availability.'}</p>}
    <p className="mt-3 text-xs text-gray-500">Availability and prices are confirmed on each bottle page or by support. Bottles are not reserved by browsing.</p>
  </section>;
}

'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { PiBinocularsBold } from 'react-icons/pi';
import BottleThumbnail from './BottleThumbnail';
import { useTenant } from '@/context/TenantContext';
import { publicBottleChoices, type BottleChoice } from '@/lib/weddingBottleList';

export default function CatalogueBottleSearch({ onAdd }: { onAdd: (bottle: BottleChoice) => boolean | void }) {
  const { tenant } = useTenant();
  const tenantId = tenant?._id;
  const [results, setResults] = useState<BottleChoice[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [hint, setHint] = useState(''), [open, setOpen] = useState(false), [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revision = useRef(0), controller = useRef<AbortController | null>(null);
  const wantsSuggestions = useRef(false);
  const cache = useRef(new Map<string, { choices: BottleChoice[]; time: number }>());
  const invalidate = useCallback(() => { revision.current++; controller.current?.abort(); if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => { invalidate(); cache.current.clear(); setResults([]); setHint(''); setStatus('idle'); setOpen(false); return invalidate; }, [tenantId, invalidate]);
  useEffect(() => { if (open && active >= 0) document.getElementById(`wedding-bottle-option-${active}`)?.scrollIntoView?.({ block: 'nearest' }); }, [active, open]);
  async function search(text: string) {
    invalidate(); setActive(-1);
    if (text.length < 2) { setHint('Type at least two characters for bottle suggestions.'); setResults([]); setStatus('idle'); setOpen(false); return; }
    const key = text.toLocaleLowerCase();
    const cached = cache.current.get(key);
    if (cached && Date.now() - cached.time < 30000) { setResults(cached.choices); setStatus('ready'); setHint(''); setOpen(wantsSuggestions.current); return; }
    const request = new AbortController(); controller.current = request;
    const run = ++revision.current;
    setStatus('loading'); setResults([]); setHint(''); setOpen(wantsSuggestions.current);
    const params = new URLSearchParams({ q: text, limit: '6', inStock: 'false', fields: 'card', searchMode: 'text' });
    if (tenantId) params.set('tenantId', tenantId);
    let timedOut = false;
    const deadline = setTimeout(() => { timedOut = true; request.abort(); }, 12000);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/products/search?${params}`, { signal: request.signal, cache: 'no-store', credentials: 'omit' });
      if (!response.ok) throw new Error('Search unavailable');
      const choices = publicBottleChoices(await response.json());
      if (run !== revision.current) return;
      if (cache.current.size >= 20) cache.current.delete(cache.current.keys().next().value!);
      cache.current.set(key, { choices, time: Date.now() });
      setResults(choices); setStatus('ready'); setOpen(wantsSuggestions.current);
    } catch {
      if ((request.signal.aborted && !timedOut) || run !== revision.current) return;
      setStatus('error');
      if (timedOut) setHint('Search took too long. Try searching again.');
    } finally { clearTimeout(deadline); }
  }
  function edit(text: string) {
    wantsSuggestions.current = true;
    invalidate(); setResults([]); setStatus('idle'); setHint(''); setActive(-1); setOpen(false);
    if (text.trim().length >= 2) timer.current = setTimeout(() => { void search(text.trim()); }, 250);
  }
  function choose(bottle: BottleChoice) {
    if (onAdd(bottle) === false) return;
    invalidate(); if (input.current) input.current.value = '';
    setResults([]); setOpen(false); setActive(-1); setStatus('idle'); setHint(`${bottle.name} selected. Adjust its quantity below.`);
    input.current?.focus();
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); wantsSuggestions.current = true; const field = event.currentTarget.elements.namedItem('search') as HTMLInputElement; void search(field.value.trim()); }
  function keyboard(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape') { wantsSuggestions.current = false; invalidate(); setOpen(false); setActive(-1); if (status === 'loading') setStatus('idle'); }
    if (results.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault(); wantsSuggestions.current = true; setOpen(true); setActive(index => event.key === 'ArrowDown' ? (index + 1) % results.length : index <= 0 ? results.length - 1 : index - 1);
    }
    if (event.key === 'Enter' && open && active >= 0 && results[active]) { event.preventDefault(); choose(results[active]); }
  }
  const expanded = open && results.length > 0;
  const warmPattern = { backgroundImage: 'repeating-linear-gradient(135deg, rgba(53,16,20,0.05) 0px, rgba(53,16,20,0.05) 1px, transparent 1px, transparent 8px)' };
  return <div>
    <form onSubmit={submit} action="/shop" method="get" className="space-y-2">
      <label htmlFor="wedding-bottle-search" className="text-sm font-semibold">Find a catalogue bottle</label>
      <div className="flex flex-wrap gap-2"><input ref={input} id="wedding-bottle-search" name="search" type="search" role="combobox" aria-autocomplete="list" aria-expanded={expanded} aria-controls="wedding-bottle-options" aria-activedescendant={expanded && active >= 0 ? `wedding-bottle-option-${active}` : undefined} onChange={event => edit(event.currentTarget.value)} onKeyDown={keyboard} onFocus={() => { wantsSuggestions.current = true; if (results.length) setOpen(true); }} onBlur={() => { wantsSuggestions.current = false; setOpen(false); setActive(-1); }} maxLength={80} placeholder="Start typing a bottle or brand" className="min-h-11 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 text-[16px] focus:border-[#7c1d1d] focus:outline-none focus:ring-2 focus:ring-[#7c1d1d]/20" aria-describedby="wedding-search-status" /><button type="submit" disabled={status === 'loading'} className="min-h-11 rounded-lg bg-[#7c1d1d] px-4 py-2 text-xs font-bold text-white hover:bg-[#571419] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d] disabled:opacity-60">{status === 'loading' ? 'Searching…' : status === 'error' ? 'Try search again' : 'Search catalogue'}</button></div>
    </form>
    <p id="wedding-search-status" role="status" aria-live="polite" className="mt-2 text-xs leading-6 text-gray-600">{hint || (status === 'error' ? 'Catalogue search is unavailable. Try again or choose drink categories for our planning team.' : status === 'loading' ? 'Searching the catalogue…' : status === 'ready' && !results.length ? 'No matches. Try another name or choose drink categories instead.' : status === 'ready' ? `${results.length} matches. Select a name to add it to your list.` : 'Suggestions appear as you type. Selecting a bottle does not reserve stock.')}</p>
    {status === 'loading' && <div aria-hidden="true" className="mt-3 space-y-2">{[0, 1, 2].map(row => <div key={row} className="flex items-center gap-3 rounded-xl border border-[#7c1d1d]/10 bg-[#fff8ec] p-3"><span className="h-12 w-12 shrink-0 rounded-lg bg-[#f7e9db] motion-safe:animate-pulse" /><span className="h-3 w-2/5 rounded-full bg-[#f7e9db] motion-safe:animate-pulse" /></div>)}</div>}
    {status === 'ready' && !results.length && <div className="mt-3 rounded-xl border border-dashed border-[#7c1d1d]/25 bg-[#fff8ec] p-4" style={warmPattern}>
      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#7c1d1d]"><PiBinocularsBold className="h-4 w-4" aria-hidden="true" />No catalogue match yet</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-6 text-gray-700">
        <li>Try a shorter brand name — for example “Hennessy” rather than the exact edition.</li>
        <li>Choose drink categories instead, and our planning team will review the request.</li>
      </ul>
    </div>}
    {expanded && <ul id="wedding-bottle-options" role="listbox" aria-label="Catalogue bottle suggestions" className="mt-3 max-h-72 overflow-y-auto divide-y divide-[#f7e9db] rounded-xl border border-rose-200 bg-white shadow-lg">{results.map((bottle, index) => <li key={bottle.productId} role="presentation"><button id={`wedding-bottle-option-${index}`} role="option" aria-selected={active === index} tabIndex={-1} type="button" onMouseDown={event => event.preventDefault()} onClick={() => choose(bottle)} className={`flex min-h-16 w-full items-center gap-3 break-words px-4 py-3 text-left text-sm font-semibold text-[#351014] hover:bg-rose-50 ${active === index ? 'bg-rose-50 outline outline-2 -outline-offset-2 outline-[#7c1d1d]' : ''}`}><BottleThumbnail src={bottle.image} /><span className="min-w-0 break-words">Add {bottle.name}</span></button></li>)}</ul>}
  </div>;
}

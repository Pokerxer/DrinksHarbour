import { useEffect, useId, useRef, useState } from 'react';
const normal = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export default function ProductFilter({
  value,
  products,
  change,
  loading = false,
  error = '',
  retry,
}: {
  value: string;
  products: { id: string; label: string }[];
  change: (value: string) => void;
  loading?: boolean;
  error?: string;
  retry?: () => void;
}) {
  const inputId = useId();
  const root = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const selected = value.split(',').filter(Boolean);
  const terms = normal(search)
    .split(/[,;\n]+/)
    .map((term) => term.trim().split(/\s+/).filter(Boolean))
    .filter((words) => words.length);
  const matches = products.filter(
    (product) =>
      !terms.length ||
      terms.some((words) => words.every((word) => normal(product.label).includes(word))),
  );
  const toggle = (id: string) =>
    change(
      selected.includes(id)
        ? selected.filter((item) => item !== id).join(',')
        : [...selected, id].join(','),
    );
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return (
    <div ref={root} className="min-w-0 sm:col-span-2">
      <label htmlFor={inputId} className="text-xs font-semibold text-gray-500">
        Products <span className="font-normal">· choose one or more</span>
      </label>
      <div className="relative mt-1.5">
        <input
          id={inputId}
          aria-label="Search products"
          aria-expanded={open}
          aria-controls={`${inputId}-choices`}
          type="search"
          value={search}
          placeholder="Search names or SKUs · separate products with commas"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setSearch(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setTimeout(
                () =>
                  root.current?.querySelector<HTMLInputElement>('input[type="checkbox"]')?.focus(),
                0,
              );
            }
          }}
          className="block min-h-11 w-full !rounded-lg !border !border-[#e7e1d8] !bg-white !px-3 !py-2 text-sm font-normal text-gray-800 focus:!border-[#b20202] focus:!outline-none focus:!ring-1 focus:!ring-[#b20202]"
        />
        {open && (
          <div
            id={`${inputId}-choices`}
            className="absolute inset-x-0 top-full z-30 mt-2 rounded-xl border border-[#ece4d6] bg-white shadow-lg"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setOpen(false);
                root.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
              }
            }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#f1ebe2] px-3 py-2 text-xs">
              <span className="text-gray-500">
                {selected.length} selected · {matches.length} matches
              </span>
              <button
                type="button"
                className="font-semibold text-[#b20202] disabled:opacity-40"
                disabled={!matches.length || loading || selected.length >= 100}
                onClick={() =>
                  change(
                    Array.from(new Set([...selected, ...matches.map((product) => product.id)]))
                      .slice(0, 100)
                      .join(','),
                  )
                }
              >
                Select matches
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto p-1">
              {loading && (
                <p role="status" className="p-3 text-xs text-gray-500">
                  Loading products…
                </p>
              )}
              {error && (
                <div role="alert" className="p-3 text-xs text-red-700">
                  {error}{' '}
                  {retry && (
                    <button type="button" className="underline" onClick={retry}>
                      Retry products
                    </button>
                  )}
                </div>
              )}
              {!loading && !matches.length && !error && (
                <p className="p-3 text-xs text-gray-500">
                  {products.length
                    ? 'No products match. Try a name or SKU.'
                    : 'No products have stock or history here yet.'}
                </p>
              )}
              {matches.slice(0, 200).map((product) => (
                <label
                  key={product.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-[#f8f5f0] ${selected.includes(product.id) ? 'bg-red-50/60 text-[#b20202]' : 'text-gray-700'}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(product.id)}
                    disabled={!selected.includes(product.id) && selected.length >= 100}
                    onChange={() => toggle(product.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#b20202]"
                  />
                  <span className="min-w-0 break-words">{product.label}</span>
                </label>
              ))}
              {matches.length > 200 && (
                <p className="p-3 text-xs text-gray-500">
                  Showing 200 matches. Refine your search to see more.
                </p>
              )}
            </div>
            <p className="border-t border-[#f1ebe2] px-3 py-2 text-xs text-gray-400">
              Comma-separated names match any product. Up to 100 selections.
            </p>
          </div>
        )}
      </div>
      {!!selected.length && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {selected.map((id) => {
            const label = products.find((product) => product.id === id)?.label || id;
            return (
              <button
                type="button"
                key={id}
                aria-label={`Remove ${label}`}
                onClick={() => toggle(id)}
                className="inline-flex max-w-full items-center gap-2 rounded-full bg-[#b20202]/5 px-3 py-1.5 text-xs font-medium text-[#b20202]"
              >
                <span className="truncate">{label}</span>
                <span aria-hidden="true">×</span>
              </button>
            );
          })}
          <button
            type="button"
            className="px-2 py-1 text-xs text-gray-500 underline"
            onClick={() => {
              change('');
              setSearch('');
            }}
          >
            All products
          </button>
        </div>
      )}
    </div>
  );
}

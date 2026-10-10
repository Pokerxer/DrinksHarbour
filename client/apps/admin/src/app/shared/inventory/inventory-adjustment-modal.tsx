'use client';
import { useEffect, useRef } from 'react';
import AdjustmentCountPreview from './adjustment-count-preview';
import { PiX } from 'react-icons/pi';
import { useAdjustmentEntry } from './use-adjustment-entry';
import { matchAdjustmentProduct, type AdjustmentMode } from './inventory-adjustment-entry-data';
export default function AdjustmentModal({
  token,
  close,
  done,
}: {
  token: string;
  close: () => void;
  done: () => void;
}) {
  const v = useAdjustmentEntry(token, done);
  const dialog = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  busy.current = v.busy;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (!busy.current) close();
      }
      if (event.key !== 'Tab') return;
      const elements = Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)',
        ) || [],
      );
      const first = elements[0],
        last = elements[elements.length - 1];
      if (!first) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [close]);
  const field =
    'mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202] disabled:bg-gray-50';
  const label = 'block text-xs font-semibold text-gray-600';
  const matches = v.products.filter((p) => matchAdjustmentProduct(p.label, v.search));
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !v.busy) close();
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="adjustment-title"
        tabIndex={-1}
        className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl outline-none"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 id="adjustment-title" className="text-lg font-bold text-gray-900">
              New adjustment
            </h2>
            <p className="mt-1 text-xs text-gray-500">Correct one product size in one warehouse.</p>
          </div>
          <button
            type="button"
            disabled={v.busy}
            onClick={close}
            aria-label="Cancel adjustment"
            className="rounded p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-40"
          >
            <PiX className="h-5 w-5" />
          </button>
        </div>
        <form
          className="overflow-auto"
          onSubmit={(e) => {
            e.preventDefault();
            void v.submit();
          }}
        >
          <fieldset disabled={v.busy || v.loading} className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
              <span>
                {v.loading ? 'Loading current warehouse stock…' : 'Counts include reserved units.'}
              </span>
              <button
                type="button"
                onClick={() => void v.load()}
                className="shrink-0 font-semibold text-[#b20202]"
              >
                Refresh counts
              </button>
            </div>
            <label className={label}>
              Warehouse
              <select
                required
                aria-label="Warehouse"
                value={v.warehouse}
                onChange={(e) => v.setWarehouse(e.target.value)}
                className={field}
              >
                <option value="">Choose warehouse</option>
                {v.warehouses.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Search products
              <input
                type="search"
                value={v.search}
                onChange={(e) => v.setSearch(e.target.value)}
                placeholder="Name or SKU"
                className={field}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={label}>
                Product
                <select
                  required
                  aria-label="Product"
                  value={v.product}
                  onChange={(e) => v.selectProduct(e.target.value)}
                  className={field}
                >
                  <option value="">Choose product</option>
                  {v.products
                    .filter((p) => p.id === v.product || matchAdjustmentProduct(p.label, v.search))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                </select>
              </label>
              <label className={label}>
                Size
                <select
                  required
                  aria-label="Size"
                  value={v.size}
                  onChange={(e) => v.setSize(e.target.value)}
                  className={field}
                >
                  <option value="">Choose size</option>
                  {v.sizes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {!v.loading &&
              !v.loadFailed &&
              (!v.warehouses.length || !v.products.length || !matches.length) && (
                <p role="status" className="text-sm text-amber-700">
                  {!v.warehouses.length
                    ? 'An active warehouse is required.'
                    : !v.products.length
                      ? 'No product sizes are available to adjust.'
                      : 'No products match your search. Try another name or SKU.'}
                </p>
              )}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={label}>
                Adjustment
                <select
                  aria-label="Adjustment method"
                  value={v.mode}
                  onChange={(e) => {
                    v.setMode(e.target.value as AdjustmentMode);
                    v.setQuantity('');
                  }}
                  className={field}
                >
                  <option value="count">Set counted quantity</option>
                  <option value="add">Add units</option>
                  <option value="remove">Remove units</option>
                </select>
              </label>
              <label className={label}>
                {v.mode === 'count' ? 'Counted quantity' : 'Units'}
                <input
                  required
                  type="number"
                  step="1"
                  min={v.mode === 'count' ? 0 : 1}
                  aria-label={v.mode === 'count' ? 'Counted quantity' : 'Units'}
                  value={v.quantity}
                  onChange={(e) => v.setQuantity(e.target.value)}
                  className={field}
                />
              </label>
            </div>
            <AdjustmentCountPreview v={v} />
            <label className={label}>
              Reason
              <input
                required
                maxLength={200}
                aria-label="Reason"
                value={v.reason}
                onChange={(e) => v.setReason(e.target.value)}
                placeholder="Why is this stock being corrected?"
                className={field}
              />
            </label>
            <label className={label}>
              Reference (optional)
              <input
                maxLength={100}
                value={v.reference}
                onChange={(e) => v.setReference(e.target.value)}
                className={field}
              />
            </label>
            <label className={label}>
              Notes (optional)
              <textarea
                maxLength={1000}
                rows={3}
                value={v.notes}
                onChange={(e) => v.setNotes(e.target.value)}
                className={field}
              />
            </label>
          </fieldset>
          {v.error && (
            <p role="alert" className="mx-5 mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {v.error}
              {!v.busy && (v.needsRefresh || v.loadFailed) && (
                <button type="button" onClick={() => void v.load()} className="ml-2 underline">
                  Refresh counts
                </button>
              )}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4">
            <button
              type="button"
              disabled={v.busy}
              onClick={close}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={v.busy || v.invalid}
              className="rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-40"
            >
              {v.busy ? 'Saving…' : 'Save adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

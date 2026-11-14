'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Description,
} from '@headlessui/react';
import { PiMinus, PiPlus, PiX, PiArrowClockwise } from 'react-icons/pi';
import toast from 'react-hot-toast';
import {
  fetchTenantOffers,
  type BuilderLine,
  type TenantOffer,
} from '@/services/whatsapp-order.service';

const fmtNgn = (n: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(n);

/** Best marketplace price across a tenant's (in-stock) sizes. */
const bestPrice = (offer: TenantOffer) =>
  offer.sizes.reduce((min, s) => Math.min(min, s.marketplacePrice), Infinity);

/** Per-tenant offer picker for one product. Always shown — even a single
 *  tenant simply becomes the size selector. Also reused by the scan drawer
 *  (Task 7): props are product-based, not catalogue-row-based. */
export default function BuilderTenantPicker({
  open,
  onClose,
  token,
  productId,
  productName,
  initialQty,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  token: string;
  productId: string | null;
  productName: string;
  /** Default quantity when the caller knows one (scan drawer seeds the AI-
   *  extracted qty); user edits always override. Defaults to 1. */
  initialQty?: number;
  onAdd: (lines: Array<Omit<BuilderLine, 'key'>>) => void;
}) {
  const [offers, setOffers] = useState<TenantOffer[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    if (!token || !productId) return;
    setLoading(true);
    setError(null);
    try {
      const raw = await fetchTenantOffers(productId, token);
      // includeAll=true surfaces unpublished/pending rows too; sizes without
      // stock cannot be ordered, and a tenant left with no sizes drops out.
      const usable = raw
        .map((o) => ({ ...o, sizes: o.sizes.filter((s) => s.availableStock > 0) }))
        .filter((o) => o.sizes.length > 0)
        .sort((a, b) => bestPrice(a) - bestPrice(b));
      setOffers(usable);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load tenant offers');
      setOffers(null);
    } finally {
      setLoading(false);
    }
  }, [productId, token]);

  useEffect(() => {
    if (!open || !productId) return;
    setOffers(null);
    setSelectedTenantId(null);
    setQty({});
    load();
  }, [open, productId, load]);

  const selected = useMemo(
    () => offers?.find((o) => o.tenantId === selectedTenantId) ?? null,
    [offers, selectedTenantId],
  );

  const addSize = (offer: TenantOffer, size: TenantOffer['sizes'][number]) => {
    const quantity = Math.max(1, Math.floor(qty[size.sizeId] ?? initialQty ?? 1));
    onAdd([
      {
        lineType: 'product',
        subProductId: offer.subProductId,
        productId: productId ?? undefined,
        sizeId: size.sizeId,
        productName: productName || undefined,
        sizeName: size.displayName,
        tenantId: offer.tenantId,
        tenantName: offer.tenantName,
        quantity,
        unitPrice: size.marketplacePrice,
        availableStock: size.availableStock,
      },
    ]);
    toast.success(
      `Added ${[productName, size.displayName].filter(Boolean).join(' · ')} × ${quantity} from ${offer.tenantName}`,
    );
  };

  const qtyButton =
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-gray-100 disabled:opacity-30';

  return (
    <Dialog open={open} onClose={onClose} className="relative z-[100]">
      <DialogBackdrop className="fixed inset-0 bg-gray-950/50 backdrop-blur-sm" />
      <div className="fixed inset-0 flex items-end justify-center p-0 sm:items-center sm:p-4">
        <DialogPanel className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
          <header className="shrink-0 border-b border-gray-200 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="text-base font-semibold tracking-tight text-gray-900">
                  {loading
                    ? 'Loading tenant offers…'
                    : `Offered by ${offers?.length ?? 0} tenant${(offers?.length ?? 0) === 1 ? '' : 's'}`}
                </DialogTitle>
                <Description className="mt-1 truncate text-xs text-gray-500">
                  {productName || 'Select a size · NGN'}
                </Description>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close tenant picker"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
              >
                <PiX className="h-4 w-4" />
              </button>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-gray-500" />
                Fetching tenant offers…
              </div>
            )}
            {!loading && error && (
              <div role="alert" className="rounded-xl border border-red-100 bg-red-50/60 p-4 text-center">
                <p className="text-sm text-gray-700">{error}</p>
                <button
                  type="button"
                  onClick={load}
                  className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark"
                >
                  <PiArrowClockwise /> Retry
                </button>
              </div>
            )}
            {!loading && !error && offers?.length === 0 && (
              <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center">
                <p className="text-sm font-semibold text-gray-800">
                  No tenants with stock
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Every listing for this product is out of stock right now.
                </p>
              </div>
            )}
            {!loading && !error && offers && offers.length > 0 && (
              <div className="space-y-2">
                {offers.map((offer) => {
                  const isSel = offer.tenantId === selectedTenantId;
                  return (
                    <div
                      key={offer.tenantId}
                      className={`overflow-hidden rounded-xl border ${isSel ? 'border-brand/50 ring-1 ring-brand/10' : 'border-gray-200'}`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedTenantId(isSel ? null : offer.tenantId)}
                        aria-expanded={isSel}
                        className={`flex min-h-12 w-full items-center justify-between gap-2 px-3 py-2 text-left ${isSel ? 'bg-brand/5' : 'hover:bg-gray-50'}`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-gray-900">
                            {offer.tenantName}
                          </span>
                          <span className="block text-xs text-gray-500">
                            {offer.sizes.length} size{offer.sizes.length === 1 ? '' : 's'} in stock
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-bold text-gray-900">
                          <span className="mr-1 text-xs font-normal text-gray-500">From</span>
                          {fmtNgn(bestPrice(offer))}
                        </span>
                      </button>
                      {isSel && (
                        <div className="space-y-3 border-t border-gray-100 px-3 py-3">
                          {offer.sizes.map((size) => {
                            const q = Math.max(1, Math.floor(qty[size.sizeId] ?? initialQty ?? 1));
                            return (
                              <div key={size.sizeId} className="rounded-lg border border-gray-100 p-2.5">
                                <div className="flex flex-wrap items-start justify-between gap-1 text-xs">
                                  <span className="font-semibold text-gray-800">
                                    {size.displayName}
                                  </span>
                                  <span className="text-gray-500">
                                    {size.availableStock} in stock
                                    {size.sku ? ` · ${size.sku}` : ''}
                                  </span>
                                </div>
                                <div className="mt-2 flex items-center justify-between gap-2">
                                  <p className="text-sm font-semibold text-gray-900">
                                    {fmtNgn(size.marketplacePrice)}
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center rounded-lg border border-gray-200 bg-white">
                                      <button
                                        type="button"
                                        className={qtyButton}
                                        disabled={q <= 1}
                                        aria-label={`Decrease ${size.displayName} quantity`}
                                        onClick={() =>
                                          setQty((prev) => ({ ...prev, [size.sizeId]: Math.max(1, q - 1) }))
                                        }
                                      >
                                        <PiMinus size={12} />
                                      </button>
                                      <input
                                        aria-label={`Quantity for ${size.displayName}`}
                                        inputMode="numeric"
                                        type="number"
                                        min="1"
                                        value={q}
                                        onChange={(e) => {
                                          const v = Number(e.target.value);
                                          if (Number.isFinite(v) && v >= 1)
                                            setQty((prev) => ({ ...prev, [size.sizeId]: Math.min(Math.floor(v), size.availableStock) }));
                                        }}
                                        className="w-10 border-0 bg-transparent p-0 text-center text-sm font-semibold focus:ring-0"
                                      />
                                      <button
                                        type="button"
                                        className={qtyButton}
                                        disabled={q >= size.availableStock}
                                        aria-label={`Increase ${size.displayName} quantity`}
                                        onClick={() =>
                                          setQty((prev) => ({
                                            ...prev,
                                            [size.sizeId]: Math.min(q + 1, size.availableStock),
                                          }))
                                        }
                                      >
                                        <PiPlus size={12} />
                                      </button>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => addSize(offer, size)}
                                      className="flex min-h-8 items-center gap-1 rounded-lg bg-gray-900 px-3 text-xs font-semibold text-white hover:bg-brand"
                                    >
                                      <PiPlus size={12} /> Add
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

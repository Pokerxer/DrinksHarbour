'use client';

/**
 * "Send as a gift?" collapsible checkout section + the packaging-SKU hook.
 *
 * Contract: docs/superpowers/specs/2026-10-27-gift-checkout-design.md.
 * The packaging SKU is added as a NORMAL cart line through the existing
 * addToCart mechanics (no new cart-item metadata) — the server cross-checks
 * that `gift.packagingRequested` orders carry exactly one item whose product
 * matches the configured gift-packaging SKU. Prices always come from the
 * product's own data; nothing is invented client-side.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Icon from 'react-icons/pi';
import { AnimatePresence, motion } from 'framer-motion';
import { API_URL } from '@/lib/api';
import { useCart } from '@/context/CartContext';
import {
  GIFT_PACKAGING_SEARCH_QUERY,
  GIFT_FROM_MAX,
  GIFT_TO_MAX,
  GIFT_MESSAGE_MAX,
  giftDateBounds,
  lagosTodayISO,
  type GiftDetails,
  type GiftFieldErrors,
} from '@/lib/giftCheckout';

// ─── Packaging SKU discovery ─────────────────────────────────────────────────

export interface GiftPackagingLine {
  cartItemId: string;
  productId: string;
  subProductId: string;
  sizeId: string;
  tenantId: string;
  size: string;
  color: string;
  vendor: string;
  websitePrice: number;
}

export interface GiftPackagingState {
  /** loading → available (SKU found + sellable) | unavailable (not configured). */
  status: 'loading' | 'available' | 'unavailable';
  line: GiftPackagingLine | null;
  price: number | null;
}

/** Picks the sellable vendor/size for the packaging product, preferring in-stock sizes. */
function pickPackagingLine(product: any, getCartItemId: (p: string, s: string, v: string, c: string) => string): GiftPackagingLine | null {
  const productId = product?._id || product?.id || '';
  if (!productId) return null;
  for (const vendorEntry of Array.isArray(product.availableAt) ? product.availableAt : []) {
    const tenantName = vendorEntry?.tenant?.name;
    if (!tenantName || !vendorEntry?._id) continue;
    const sellable = (vendorEntry.sizes || []).filter(
      (s: any) => s?._id && typeof s?.pricing?.websitePrice === 'number' && s.pricing.websitePrice > 0,
    );
    if (sellable.length === 0) continue;
    const size =
      sellable.find((s: any) => (s.stock ?? 0) > 0) ||
      sellable.find((s: any) => s.stock == null) ||
      sellable[0];
    const color = '';
    return {
      cartItemId: getCartItemId(productId, size.size, tenantName, color),
      productId,
      subProductId: vendorEntry._id,
      sizeId: size._id,
      tenantId: vendorEntry.tenant?._id || '',
      size: size.size,
      color,
      vendor: tenantName,
      websitePrice: size.pricing.websitePrice,
    };
  }
  return null;
}

/**
 * Fetches the gift-packaging SKU via the public product search and exposes the
 * cart-line machinery for it. `setRequested(true)` adds the SKU as a normal
 * cart line (qty 1); `setRequested(false)` removes it again.
 */
export function useGiftPackaging(): GiftPackagingState & {
  inCart: boolean;
  setRequested: (requested: boolean) => void;
} {
  const { cartState, addToCart, removeFromCart, getCartItemId } = useCart();
  const [state, setState] = useState<GiftPackagingState>({ status: 'loading', line: null, price: null });
  const startedRef = useRef(false);
  const productRef = useRef<any>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;
    // `inStock=false` means "no stock filter" server-side, so a configured-but-
    // zero-stock SKU is still discoverable and we judge sellability ourselves.
    // `isGiftPackaging=true` is honored by the server once the field is surfaced
    // in search; the client-side scan below is the tolerant fallback either way.
    const params = new URLSearchParams({
      q: GIFT_PACKAGING_SEARCH_QUERY,
      isGiftPackaging: 'true',
      inStock: 'false',
      limit: '5',
    });
    fetch(`${API_URL}/api/products/search?${params}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (cancelled) return;
        const products: any[] = d?.data?.products ?? [];
        const found = products.find(p => p?.isGiftPackaging === true);
        const line = found ? pickPackagingLine(found, getCartItemId) : null;
        productRef.current = line ? found : null;
        setState(
          line
            ? { status: 'available', line, price: line.websitePrice }
            : { status: 'unavailable', line: null, price: null },
        );
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'unavailable', line: null, price: null });
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inCart = !!state.line && cartState.cartArray.some(i => i.cartItemId === state.line!.cartItemId);

  const setRequested = useCallback((requested: boolean) => {
    const line = state.line;
    const product = productRef.current;
    if (!line || !product) return;
    if (requested && !inCart) {
      addToCart(product, line.size, line.color, line.vendor, line.tenantId, 1, line.sizeId, line.subProductId);
    } else if (!requested && inCart) {
      removeFromCart(line.cartItemId);
    }
  }, [state.line, inCart, addToCart, removeFromCart]);

  return { ...state, inCart, setRequested };
}

// ─── Section ─────────────────────────────────────────────────────────────────

const inputCls = (err?: string) =>
  `w-full px-4 py-2.5 border rounded-xl text-sm outline-none transition-all ${
    err
      ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-2 focus:ring-red-100'
      : 'border-gray-200 bg-gray-50 focus:bg-white focus:border-red-400 focus:ring-2 focus:ring-red-100'
  }`;

/** Field id → input id, so submit-time validation can focus the first invalid field. */
const FIELD_INPUT_IDS: Array<[keyof GiftDetails, string]> = [
  ['from', 'gift-from'],
  ['to', 'gift-to'],
  ['message', 'gift-message'],
  ['requestedDeliveryDate', 'gift-date'],
];

interface CheckoutGiftSectionProps {
  enabled: boolean;
  details: GiftDetails;
  errors: GiftFieldErrors;
  /** Bumped by the parent when submit-time validation fails — focuses the first invalid field. */
  submitTick: number;
  packaging: GiftPackagingState & { inCart: boolean; setRequested: (requested: boolean) => void };
  formatPrice: (n: number) => string;
  onToggle: () => void;
  onChange: (patch: Partial<GiftDetails>) => void;
}

export default function CheckoutGiftSection({
  enabled,
  details,
  errors,
  submitTick,
  packaging,
  formatPrice,
  onToggle,
  onChange,
}: CheckoutGiftSectionProps) {
  const bounds = giftDateBounds(lagosTodayISO());

  // Focus the first invalid field after a failed submit.
  useEffect(() => {
    if (!enabled || submitTick === 0) return;
    for (const [key, id] of FIELD_INPUT_IDS) {
      if (errors[key]) {
        document.getElementById(id)?.focus();
        break;
      }
    }
  }, [submitTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const errProps = (field: keyof GiftDetails) => ({
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? `gift-${field}-error` : undefined,
  });
  const errorLine = (field: keyof GiftDetails) =>
    errors[field] ? (
      <p id={`gift-${field}-error`} className="mt-1 text-xs text-red-500 flex items-center gap-1">
        <Icon.PiWarningCircleBold size={11} />{errors[field]}
      </p>
    ) : null;

  const packagingAvailable = packaging.status === 'available' && !!packaging.line;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={enabled}
        aria-controls="gift-section-panel"
        className="w-full flex items-center gap-2.5 px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-900 to-red-950 text-left"
      >
        <Icon.PiGiftBold size={16} className="text-red-400" />
        <h2 className="text-sm font-black text-white flex-1">Send as a gift?</h2>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${enabled ? 'bg-red-700 text-white' : 'bg-gray-700 text-gray-300'}`}>
          {enabled ? 'On' : 'Off'}
        </span>
        <Icon.PiCaretDownBold size={12} className={`text-gray-400 transition-transform ${enabled ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence initial={false}>
        {enabled && (
          <motion.div
            id="gift-section-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-5 space-y-4">
              {/* From / To */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="gift-from" className="text-xs font-semibold text-gray-600 mb-1.5 block">
                    From <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="gift-from"
                    type="text"
                    maxLength={GIFT_FROM_MAX}
                    value={details.from}
                    onChange={e => onChange({ from: e.target.value })}
                    placeholder="Your name"
                    className={inputCls(errors.from)}
                    {...errProps('from')}
                  />
                  {errorLine('from')}
                </div>
                <div>
                  <label htmlFor="gift-to" className="text-xs font-semibold text-gray-600 mb-1.5 block">
                    To <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="gift-to"
                    type="text"
                    maxLength={GIFT_TO_MAX}
                    value={details.to}
                    onChange={e => onChange({ to: e.target.value })}
                    placeholder="Recipient's name"
                    className={inputCls(errors.to)}
                    {...errProps('to')}
                  />
                  {errorLine('to')}
                </div>
              </div>

              {/* Message */}
              <div>
                <label htmlFor="gift-message" className="text-xs font-semibold text-gray-600 mb-1.5 block">
                  Gift note <span className="text-gray-400 font-normal">(printed on the card)</span>
                </label>
                <textarea
                  id="gift-message"
                  rows={3}
                  maxLength={GIFT_MESSAGE_MAX}
                  value={details.message}
                  onChange={e => onChange({ message: e.target.value })}
                  placeholder="A short message for the recipient…"
                  className={`${inputCls(errors.message)} resize-none`}
                  {...errProps('message')}
                />
                <div className="flex items-center justify-between mt-1">
                  {errorLine('message') ?? <span />}
                  <span className={`text-[11px] ${details.message.length >= GIFT_MESSAGE_MAX ? 'text-red-500' : 'text-gray-400'}`}>
                    {details.message.length}/{GIFT_MESSAGE_MAX}
                  </span>
                </div>
              </div>

              {/* Requested delivery date */}
              <div>
                <label htmlFor="gift-date" className="text-xs font-semibold text-gray-600 mb-1.5 block">
                  Requested delivery date <span className="text-red-500">*</span>
                </label>
                <input
                  id="gift-date"
                  type="date"
                  min={bounds.min}
                  max={bounds.max}
                  value={details.requestedDeliveryDate}
                  onChange={e => onChange({ requestedDeliveryDate: e.target.value })}
                  className={inputCls(errors.requestedDeliveryDate)}
                  {...errProps('requestedDeliveryDate')}
                />
                <p className="mt-1 text-xs text-gray-400 flex items-center gap-1">
                  <Icon.PiInfoBold size={11} />
                  Requested — our team confirms the exact window. Never a guaranteed date.
                </p>
                {errorLine('requestedDeliveryDate')}
              </div>

              {/* Gift packaging */}
              <div>
                <label
                  className={`flex items-start gap-2.5 p-3 rounded-xl border text-sm transition-all ${
                    packagingAvailable
                      ? 'cursor-pointer border-gray-200 bg-gray-50 hover:border-red-200 hover:bg-red-50/40'
                      : 'opacity-60 cursor-not-allowed border-gray-100 bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-red-700"
                    checked={details.packagingRequested}
                    disabled={!packagingAvailable}
                    onChange={e => {
                      onChange({ packagingRequested: e.target.checked });
                      if (packagingAvailable) packaging.setRequested(e.target.checked);
                    }}
                  />
                  <span className="flex-1">
                    <span className="font-semibold text-gray-800">Add gift packaging</span>
                    {packagingAvailable && packaging.price != null && (
                      <span className="ml-1.5 text-[11px] font-bold text-gray-500">{formatPrice(packaging.price)}</span>
                    )}
                    <span className="block text-xs text-gray-400 mt-0.5">
                      {packaging.status === 'loading'
                        ? 'Checking availability…'
                        : packagingAvailable
                          ? 'Confirmed price shown at checkout.'
                          : 'Gift packaging is not available yet.'}
                    </span>
                  </span>
                </label>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

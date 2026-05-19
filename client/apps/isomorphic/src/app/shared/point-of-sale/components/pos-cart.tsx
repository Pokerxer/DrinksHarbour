'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';
import { EmptyProductBoxIcon, Text } from 'rizzui';
import {
  PiPlus, PiUser, PiNotePencil, PiX, PiMagnifyingGlass,
  PiTag, PiNote, PiArrowCounterClockwise, PiTrash,
  PiBarcode, PiStar, PiList, PiLinkSimple,
  PiCheckCircle, PiSpinner,
} from 'react-icons/pi';
import {
  usePOSCart, usePOSUI, usePOSAuth, usePOSPricelist, usePOSAvailablePricelists,
  getBestBundle, getEffectiveBundlePrice,
  getBestBundleForItem, getEffectiveBundlePriceForItem,
  computeItemPriceChain,
} from '@/app/shared/point-of-sale/store';
import { POSCartItem } from '@/app/shared/point-of-sale/types';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';
import { posApi } from '@/app/shared/point-of-sale/api';
import toast from 'react-hot-toast';

// ── helpers ────────────────────────────────────────────────────────────────────
function itemKey(item: POSCartItem) {
  return item.sizeId ? `${item.subProductId}_${item.sizeId}` : item.subProductId;
}

type DialMode = 'qty' | 'disc' | 'price';

// ── Pricelist modal ────────────────────────────────────────────────────────────
function PricelistModal({ token, onClose }: { token: string; onClose: () => void }) {
  const { selectedPricelist, setSelectedPricelist } = usePOSPricelist();
  const { pricelists, loaded, load } = usePOSAvailablePricelists();
  const loading = !loaded;

  useEffect(() => { if (token) load(token); }, [token, load]);

  function select(pl: any) {
    setSelectedPricelist(pl);
    if (pl)  toast.success(`Pricelist applied: ${pl.name}`, { icon: '🏷️' });
    else     toast('Standard pricing restored', { icon: '↩️' });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Select Pricelist</h2>
            <p className="text-[11px] text-gray-400">Prices update immediately on the product grid</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <PiX className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="py-2">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-gray-400">
              <PiSpinner className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <>
              {/* Standard / no pricelist */}
              <button
                type="button"
                onClick={() => select(null)}
                className={`flex w-full items-center gap-3 px-5 py-3 text-left text-sm transition-colors hover:bg-gray-50 ${
                  !selectedPricelist ? 'font-semibold text-[#b20202]' : 'text-gray-700'
                }`}
              >
                {!selectedPricelist
                  ? <PiCheckCircle className="h-4 w-4 shrink-0 text-[#b20202]" />
                  : <span className="h-4 w-4 shrink-0 rounded-full border-2 border-gray-300" />}
                <span className="flex-1">Standard Price</span>
                <span className="text-[10px] text-gray-400">No override</span>
              </button>

              {pricelists.length > 0 && <div className="mx-4 my-1 border-t border-gray-100" />}

              {pricelists.length === 0 && !loading && (
                <p className="px-5 py-4 text-center text-xs text-gray-400">
                  No selectable pricelists configured.<br />
                  <span className="text-gray-300">Mark a pricelist as "Selectable" in the admin.</span>
                </p>
              )}

              {pricelists.map(pl => {
                const active = selectedPricelist?._id === pl._id;
                return (
                  <button
                    key={pl._id}
                    type="button"
                    onClick={() => select(pl)}
                    className={`flex w-full items-center gap-3 px-5 py-3.5 text-left text-sm transition-colors hover:bg-gray-50 ${
                      active ? 'bg-[#b20202]/5 font-semibold text-[#b20202]' : 'text-gray-700'
                    }`}
                  >
                    {active
                      ? <PiCheckCircle className="h-4 w-4 shrink-0 text-[#b20202]" />
                      : <PiTag className="h-4 w-4 shrink-0 text-gray-300" />}
                    <div className="flex-1 min-w-0">
                      <p className="truncate">{pl.name}</p>
                      {pl.rules?.length > 0 && (
                        <p className="text-[10px] text-gray-400">{pl.rules.length} rule{pl.rules.length !== 1 ? 's' : ''}</p>
                      )}
                    </div>
                    {pl.currency && pl.currency !== 'NGN' && (
                      <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                        {pl.currency}
                      </span>
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>

        <div className="border-t border-gray-100 px-5 py-3 text-right">
          <button type="button" onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Actions modal ──────────────────────────────────────────────────────────────
function ActionsModal({
  onDiscount,
  onNote,
  onPricelist,
  onCancelOrder,
  onClose,
}: {
  onDiscount: () => void;
  onNote: () => void;
  onPricelist: () => void;
  onCancelOrder: () => void;
  onClose: () => void;
}) {
  const { selectedPricelist } = usePOSPricelist();

  const actions = [
    { label: 'General Note', icon: <PiNote className="h-5 w-5" />, fn: () => { onNote(); onClose(); } },
    { label: 'Quotation/Order', icon: <PiLinkSimple className="h-5 w-5" />, fn: null },
    { label: 'Enter Code', icon: <PiBarcode className="h-5 w-5" />, fn: null },
    { label: 'Reward', icon: <PiStar className="h-5 w-5" />, fn: null },
    { label: 'Discount', icon: <PiTag className="h-5 w-5" />, fn: () => { onDiscount(); onClose(); } },
    { label: 'Customer Note', icon: <PiNote className="h-5 w-5" />, fn: () => { onNote(); onClose(); } },
    { label: selectedPricelist ? selectedPricelist.name : 'Price List', icon: <PiList className="h-5 w-5" />, fn: () => { onPricelist(); onClose(); }, active: !!selectedPricelist },
    { label: 'Refund', icon: <PiArrowCounterClockwise className="h-5 w-5" />, fn: null },
    { label: 'Cancel Order', icon: <PiTrash className="h-5 w-5" />, fn: () => { onCancelOrder(); onClose(); }, danger: true },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Actions</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <PiX className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3 p-6">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={a.fn ?? undefined}
              disabled={!a.fn}
              className={`flex flex-col items-center justify-center gap-2 rounded-xl py-8 text-sm font-medium transition-colors ${
                !a.fn
                  ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                  : (a as any).danger
                  ? 'bg-red-50 text-red-600 hover:bg-red-100'
                  : (a as any).active
                  ? 'bg-[#b20202]/10 text-[#b20202] hover:bg-[#b20202]/15 ring-1 ring-[#b20202]/30'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {a.icon}
              <span className="max-w-[80px] truncate text-center leading-tight">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Customer modal ─────────────────────────────────────────────────────────────
function CustomerModal({
  current,
  onSelect,
  onClose,
}: {
  current: { firstName: string; lastName: string; phone: string };
  onSelect: (name: string, phone: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [name, setName] = useState(
    current.firstName !== 'Walk-in' ? `${current.firstName} ${current.lastName}` : ''
  );
  const [phone, setPhone] = useState(current.phone);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function handleApply() {
    onSelect(name.trim() || 'Walk-in Customer', phone.trim());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200"
          >
            Discard
          </button>
          <div className="relative flex-1">
            <PiMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Customers…"
              className="h-9 w-full rounded-lg border border-gray-200 pl-9 pr-3 text-sm outline-none focus:border-[#b20202]"
            />
          </div>
        </div>

        {/* Quick set customer */}
        <div className="border-b border-gray-100 px-5 py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Set for this order
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Customer name"
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#b20202]"
            />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone"
              className="w-32 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#b20202]"
            />
            <button
              type="button"
              onClick={handleApply}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: '#b20202' }}
            >
              Apply
            </button>
          </div>
        </div>

        {/* Walk-in placeholder */}
        <div className="flex-1 px-5 py-3">
          <div className="grid grid-cols-4 border-b border-gray-100 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            <span>Name</span>
            <span>Address</span>
            <span>Contact</span>
            <span>Balance</span>
          </div>
          <button
            type="button"
            onClick={() => onSelect('Walk-in', '')}
            className="flex w-full items-center border-b border-gray-50 py-3 text-left text-sm hover:bg-gray-50"
          >
            <span className="flex-1 font-medium text-gray-800">Walk-in Customer</span>
            <span className="flex-1 text-gray-400">—</span>
            <span className="flex-1 text-gray-400">—</span>
            <span className="text-gray-400">—</span>
          </button>
          <p className="mt-4 text-center text-xs text-gray-300">
            Customer list integration coming soon
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main cart ──────────────────────────────────────────────────────────────────
export default function POSCart() {
  const {
    carts,
    activeCartId,
    activeCartRef,
    addCart,
    switchCart,
    removeCart,
    items,
    total,
    subtotal,
    discountAmount,
    discountType,
    discountValue,
    customer,
    note,
    itemCount,
    removeItem,
    updateQuantity,
    updateItemDiscount,
    updateItemPrice,
    clearCart,
    setDiscount,
    setNote,
    setCustomer,
  } = usePOSCart();

  const { setActiveView } = usePOSUI();
  const { staff, token } = usePOSAuth();
  const { selectedPricelist, setSelectedPricelist } = usePOSPricelist();
  const staffPerms: string[] = staff?.posPermissions ?? [];
  const canDiscount = staffPerms.includes('pos:discount');
  const canRefund   = staffPerms.includes('pos:refund');

  // UI state
  const [showActions,   setShowActions]   = useState(false);
  const [showCustomer,  setShowCustomer]  = useState(false);
  const [showNote,      setShowNote]      = useState(false);
  const [showDiscount,  setShowDiscount]  = useState(false);
  const [showPricelist, setShowPricelist] = useState(false);

  // Dialpad state
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [dialMode, setDialMode] = useState<DialMode>('qty');
  const [dialInput, setDialInput] = useState('');

  // When switching carts, reset dialpad selection
  const prevCartIdRef = useRef(activeCartId);
  if (prevCartIdRef.current !== activeCartId) {
    prevCartIdRef.current = activeCartId;
    // reset without triggering re-render — handled by useEffect below
  }

  const selectedItem = items.find((i) => itemKey(i) === selectedKey) ?? null;

  function getInitialInput(item: POSCartItem, mode: DialMode) {
    if (mode === 'qty') return String(item.quantity);
    if (mode === 'disc') return String(item.discount);
    if (mode === 'price') return String(item.price);
    return '0';
  }

  function selectItem(item: POSCartItem) {
    const key = itemKey(item);
    setSelectedKey(key);
    setDialInput(getInitialInput(item, dialMode));
  }

  function applyDial(input: string, mode: DialMode, item: POSCartItem) {
    const num = parseFloat(input) || 0;
    if (mode === 'qty')   updateQuantity(item.subProductId, Math.max(1, Math.round(num)), item.sizeId);
    if (mode === 'disc')  updateItemDiscount(item.subProductId, num, item.sizeId);
    if (mode === 'price') updateItemPrice(item.subProductId, num, item.sizeId);
  }

  const pushDigit = useCallback((d: string) => {
    if (!selectedItem) return;
    let next: string;
    if (d === '.') {
      next = dialInput.includes('.') ? dialInput : (dialInput || '0') + '.';
    } else {
      next = dialInput === '0' ? d : dialInput.length >= 8 ? dialInput : dialInput + d;
    }
    setDialInput(next);
    applyDial(next, dialMode, selectedItem);
  }, [dialInput, dialMode, selectedItem]);

  const pushBackspace = useCallback(() => {
    if (!selectedItem) return;
    const next = dialInput.slice(0, -1) || '0';
    setDialInput(next);
    applyDial(next, dialMode, selectedItem);
  }, [dialInput, dialMode, selectedItem]);

  const pushPlusMinus = useCallback(() => {
    if (!selectedItem || dialMode !== 'disc') return;
    // Toggle negative not meaningful for our use-cases; for disc, just clear
    const next = dialInput.startsWith('-') ? dialInput.slice(1) : '0';
    setDialInput(next);
    applyDial(next, dialMode, selectedItem);
  }, [dialInput, dialMode, selectedItem]);

  function changeMode(m: DialMode) {
    setDialMode(m);
    if (selectedItem) setDialInput(getInitialInput(selectedItem, m));
  }

  // Reset dialpad when switching carts
  useEffect(() => {
    setSelectedKey(null);
    setDialInput('');
  }, [activeCartId]);

  // Auto-select the last added item so the dialpad is immediately usable
  useEffect(() => {
    if (items.length === 0) {
      setSelectedKey(null);
      setDialInput('');
      return;
    }
    // If current selection no longer exists in the cart, fall back to the last item
    const stillValid = items.some((i) => itemKey(i) === selectedKey);
    if (!stillValid) {
      const last = items[items.length - 1];
      setSelectedKey(itemKey(last));
      setDialInput(String(last.quantity));
    }
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleNewOrder() {
    addCart();
  }

  function handleSetCustomer(name: string, phone: string) {
    const parts = name.trim().split(/\s+/);
    setCustomer({
      firstName: parts[0] || 'Walk-in',
      lastName: parts.slice(1).join(' ') || 'Customer',
      email: 'walkin@pos.local',
      phone,
    });
    setShowCustomer(false);
  }

  function handleCheckout() {
    if (!items.length) return toast.error('Cart is empty');
    setActiveView('payment');
  }

  const hasCustomer = customer.firstName !== 'Walk-in';
  const customerLabel = hasCustomer
    ? `${customer.firstName} ${customer.lastName}`.trim()
    : 'Customer';

  // Numpad layout — 4 cols: digits (3) + modes (1)
  const numpadRows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['+/-', '0', '.'],
  ];
  const modeRows: DialMode[] = ['qty', 'disc', 'price'];
  const modeLabels: Record<DialMode, string> = { qty: 'Qty', disc: '%', price: 'Price' };

  const disabled = !selectedItem;

  return (
    <>
      <div className="flex h-full flex-col bg-white">

        {/* ── Cart tabs ── */}
        <div className="flex shrink-0 items-center border-b border-gray-200 bg-gray-50">
          {/* New cart button */}
          <button
            type="button"
            onClick={handleNewOrder}
            className="flex h-10 w-10 shrink-0 items-center justify-center border-r border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-[#b20202] transition-colors"
            title="New order"
          >
            <PiPlus className="h-4 w-4" />
          </button>

          {/* Tabs */}
          <div className="flex flex-1 overflow-x-auto scrollbar-none">
            {carts.map((cart) => {
              const isActive = cart.id === activeCartId;
              const cartItemCount = cart.items.reduce((s, i) => s + i.quantity, 0);
              return (
                <div
                  key={cart.id}
                  className={`group flex shrink-0 items-center gap-1.5 border-r border-gray-200 px-3 py-2 transition-colors ${
                    isActive
                      ? 'bg-white border-b-2 border-b-[#b20202] text-[#b20202]'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => switchCart(cart.id)}
                    className="flex items-center gap-1.5 text-xs font-semibold"
                  >
                    <span>{cart.ref}</span>
                    {cartItemCount > 0 && (
                      <span className={`flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                        isActive ? 'bg-[#b20202] text-white' : 'bg-gray-300 text-gray-700'
                      }`}>
                        {cartItemCount}
                      </span>
                    )}
                  </button>
                  {carts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCart(cart.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                      title="Close order"
                    >
                      <PiX className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Customer badge */}
          {hasCustomer && (
            <div className="shrink-0 border-l border-gray-200 px-3 py-2">
              <span className="truncate text-xs font-medium text-[#b20202]">
                {customerLabel.split(' ')[0]}
              </span>
            </div>
          )}
        </div>

        {/* ── Item list ── */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center">
              <EmptyProductBoxIcon className="h-16 w-16 text-gray-200" />
              <Text className="mt-2 text-sm text-gray-400">Add products to get started</Text>
            </div>
          ) : (
            <div>
              {items.map((item) => {
                const key = itemKey(item);
                const isSelected = selectedKey === key;
                // Use pricelist-aware helpers so display stays live when pricelist changes
                const bestBundle = selectedPricelist
                  ? getBestBundleForItem(item, selectedPricelist)
                  : getBestBundle(item);
                const { price: effectivePrice, overrides: bundleOverrides } = selectedPricelist
                  ? getEffectiveBundlePriceForItem(item, selectedPricelist)
                  : getEffectiveBundlePrice(item);
                const lineGross     = effectivePrice * item.quantity;
                const itemDiscAmt   = lineGross * Math.max(0, Math.min(100, item.discount)) / 100;
                let bundleDiscAmt   = 0;
                if (bestBundle && !bundleOverrides) {
                  const dt = bestBundle.discountType ?? 'percentage';
                  bundleDiscAmt = dt === 'fixed'
                    ? Math.max(0, Math.min((bestBundle.discount ?? 0) * item.quantity, lineGross - itemDiscAmt))
                    : Math.max(0, lineGross * Math.min(100, bestBundle.discount ?? 0) / 100);
                }
                const lineTotal = Math.max(0, lineGross - itemDiscAmt - bundleDiscAmt);
                const bundleActive  = bestBundle && (bundleDiscAmt > 0 || bundleOverrides);

                const bundleLabel = bundleActive ? (() => {
                  const dt   = bestBundle!.discountType ?? 'percentage';
                  const name = bestBundle!.name ? ` (${bestBundle!.name})` : '';
                  if (dt === 'markup_on_cost')
                    return `📦 Bundle${name}: Cost +${bestBundle!.discount ?? 0}% markup → ${formatCurrency(effectivePrice)}/unit`;
                  if (dt === 'no_discount')
                    return `📦 Bundle${name}: No discount → ${formatCurrency(effectivePrice)}/unit`;
                  if (dt === 'fixed')
                    return `📦 Bundle${name}: -${formatCurrency((bestBundle!.discount ?? 0) * item.quantity)}`;
                  return `📦 Bundle${name}: -${bestBundle!.discount ?? 0}%`;
                })() : null;
                const qtyDisplay = isSelected && dialMode === 'qty' && dialInput !== ''
                  ? dialInput
                  : String(item.quantity);

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectItem(item)}
                    className={`w-full border-b border-gray-100 px-4 py-3 text-left transition-colors ${
                      isSelected ? 'bg-red-50 border-l-4 border-l-[#b20202]' : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                    }`}
                  >
                    {/* Row 1: name + total */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex-1 text-sm font-semibold leading-tight text-gray-900">
                        {item.name}{item.variant ? ` - ${item.variant}` : ''}
                      </span>
                      <span className={`shrink-0 text-sm font-bold ${
                        bundleDiscAmt > 0 ? 'text-purple-700'
                        : effectivePrice < item.price ? 'text-emerald-700'
                        : 'text-gray-900'
                      }`}>
                        {formatCurrency(lineTotal)}
                      </span>
                    </div>
                    {/* Row 2: qty × price / unit + cashier discount */}
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                      <span className={`inline-block rounded border px-1.5 py-0.5 font-semibold tabular-nums ${
                        isSelected && dialMode === 'qty'
                          ? 'border-[#b20202] bg-white text-[#b20202]'
                          : 'border-gray-300 bg-white text-gray-700'
                      }`}>
                        {qtyDisplay}
                      </span>
                      <span>×</span>
                      <span className={bundleOverrides ? 'font-semibold text-purple-700' : effectivePrice < item.price ? 'font-semibold text-emerald-700' : ''}>
                        {formatCurrency(effectivePrice)}
                        {!bundleOverrides && Math.abs(effectivePrice - item.price) > 0.001 && (
                          <span className="ml-1 font-normal text-gray-400 line-through text-[10px]">{formatCurrency(item.price)}</span>
                        )}
                        {bundleOverrides && item.price !== effectivePrice && (
                          <span className="ml-1 font-normal text-gray-400 line-through text-[10px]">{formatCurrency(item.price)}</span>
                        )}
                      </span>
                      <span>/ Units</span>
                      {item.discount > 0 && (
                        <span className="ml-1 rounded bg-red-50 px-1.5 text-[#b20202]">
                          -{item.discount}%
                        </span>
                      )}
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeItem(item.subProductId, item.sizeId);
                          if (selectedKey === key) { setSelectedKey(null); setDialInput(''); }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.stopPropagation();
                            removeItem(item.subProductId, item.sizeId);
                            if (selectedKey === key) { setSelectedKey(null); setDialInput(''); }
                          }
                        }}
                        className="ml-auto cursor-pointer text-gray-300 hover:text-red-500"
                      >
                        <PiX className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    {/* Bundle discount sub-line — appears as soon as qty hits threshold */}
                    {bundleLabel && (
                      <div className="mt-1 flex items-center justify-between rounded-md bg-purple-50 px-2 py-1 text-[10px] font-semibold text-purple-700">
                        <span>{bundleLabel}</span>
                        <span className="tabular-nums">-{formatCurrency(bundleDiscAmt)}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Note / Discount panels ── */}
        {showNote && (
          <div className="shrink-0 border-t border-gray-100 bg-gray-50 px-4 py-3">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Internal note…"
              rows={2}
              autoFocus
              className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#b20202]"
            />
            <button
              onClick={() => setShowNote(false)}
              className="mt-1.5 text-xs text-gray-400 hover:text-gray-600"
            >
              Done
            </button>
          </div>
        )}

        {showDiscount && (
          <div className="shrink-0 border-t border-gray-100 bg-gray-50 px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Order Discount
            </p>
            <div className="flex gap-2">
              <select
                value={discountType}
                onChange={(e) => setDiscount(e.target.value as 'percent' | 'fixed', discountValue)}
                className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-[#b20202]"
              >
                <option value="percent">%</option>
                <option value="fixed">Fixed ₦</option>
              </select>
              <input
                type="number"
                value={discountValue || ''}
                onChange={(e) => setDiscount(discountType, Number(e.target.value))}
                placeholder="0"
                autoFocus
                className="w-24 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-[#b20202]"
                min={0}
                max={discountType === 'percent' ? 100 : subtotal}
              />
              <button
                onClick={() => { setDiscount(discountType, 0); setShowDiscount(false); }}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
              >
                Clear
              </button>
              <button
                onClick={() => setShowDiscount(false)}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
                style={{ backgroundColor: '#b20202' }}
              >
                Apply
              </button>
            </div>
          </div>
        )}

        {/* ── Active pricelist chip ── */}
        {selectedPricelist && (
          <div className="shrink-0 flex items-center justify-between border-t border-gray-100 bg-emerald-50 px-4 py-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
              <PiTag className="h-3 w-3 shrink-0" />
              <span className="truncate">{selectedPricelist.name}</span>
            </div>
            <button
              type="button"
              onClick={() => { setSelectedPricelist(null); toast('Standard pricing restored', { icon: '↩️' }); }}
              className="ml-2 shrink-0 rounded p-0.5 text-emerald-500 hover:bg-emerald-100 hover:text-emerald-700"
              title="Clear pricelist"
            >
              <PiX className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* ── Pricelist price breakdown (shown when pricelist is active) ── */}
        {selectedPricelist && items.some(item => {
          const { steps } = computeItemPriceChain(item, selectedPricelist);
          return steps.length > 0;
        }) && (
          <div className="shrink-0 border-t border-gray-100 bg-gray-50/50 px-4 py-2">
            <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-400">Price adjustments from {selectedPricelist.name}</p>
            <div className="space-y-0.5">
              {items.map(item => {
                const { steps } = computeItemPriceChain(item, selectedPricelist);
                if (!steps.length) return null;
                return (
                  <div key={item.subProductId + (item.sizeId || '')} className="flex items-start gap-2 text-[10px]">
                    <span className="text-gray-500 truncate max-w-[100px]">{item.name}{item.variant ? ` (${item.variant})` : ''}</span>
                    <span className="shrink-0 text-gray-400">×{item.quantity}</span>
                    <div className="flex flex-wrap gap-1">
                      {steps.map((s, i) => (
                        <span key={i} className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700 font-semibold">
                          {s.label}: -{formatCurrency(s.saving * item.quantity)}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Total ── */}
        <div className="shrink-0 border-t border-gray-200 px-4 py-2.5">
          {discountAmount > 0 && (
            <div className="mb-1 flex justify-between text-sm text-gray-500">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
          )}
          {discountAmount > 0 && (
            <div className="mb-1 flex justify-between text-sm text-[#b20202]">
              <span>Discount</span>
              <span>-{formatCurrency(discountAmount)}</span>
            </div>
          )}
          <div className="flex items-baseline justify-between">
            <span className="text-base font-bold text-gray-900">Total</span>
            <span className={`text-lg font-bold ${selectedPricelist ? 'text-emerald-700' : 'text-gray-900'}`}>
              {formatCurrency(total)}
            </span>
          </div>
        </div>

        {/* ── Action bar ── */}
        <div className="shrink-0 grid grid-cols-3 gap-px border-t border-gray-200 bg-gray-200">
          <button
            type="button"
            onClick={() => setShowCustomer(true)}
            className={`flex items-center justify-center gap-1.5 bg-white py-2.5 text-xs font-medium transition-colors hover:bg-gray-50 ${
              hasCustomer ? 'text-[#b20202]' : 'text-gray-600'
            }`}
          >
            <PiUser className="h-3.5 w-3.5" />
            {hasCustomer ? customerLabel.split(' ')[0] : 'Customer'}
          </button>
          <button
            type="button"
            onClick={() => setShowNote(!showNote)}
            className={`flex items-center justify-center gap-1.5 bg-white py-2.5 text-xs font-medium transition-colors hover:bg-gray-50 ${
              note ? 'text-[#b20202]' : 'text-gray-600'
            }`}
          >
            <PiNotePencil className="h-3.5 w-3.5" />
            Internal Note
          </button>
          <button
            type="button"
            onClick={() => setShowActions(true)}
            className="flex items-center justify-center gap-1.5 bg-white py-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            <PiList className="h-3.5 w-3.5" />
            Actions
          </button>
        </div>

        {/* ── Numpad ── */}
        <div className="shrink-0 border-t border-gray-200 bg-gray-50 p-2">
          {disabled ? (
            <div className="flex h-[196px] items-center justify-center">
              <p className="text-xs text-gray-400">Add a product to use the dialpad</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1.5">
              {numpadRows.map((row, ri) => (
                <React.Fragment key={ri}>
                  {row.map((key) => {
                    let cls = 'bg-white border border-gray-200 text-gray-800 hover:bg-gray-100';
                    if (key === '+/-') cls = 'bg-amber-100 border border-amber-200 text-amber-800 hover:bg-amber-200';
                    if (key === '.') cls = 'bg-orange-50 border border-orange-100 text-orange-600 hover:bg-orange-100';
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          if (key === '+/-') pushPlusMinus();
                          else pushDigit(key);
                        }}
                        className={`flex h-12 items-center justify-center rounded-xl text-base font-semibold transition-all active:scale-95 ${cls}`}
                      >
                        {key}
                      </button>
                    );
                  })}
                  {/* Mode key for this row */}
                  {ri < 3 ? (
                    <button
                      key={`mode-${ri}`}
                      type="button"
                      disabled={modeRows[ri] === 'disc' && !canDiscount}
                      title={modeRows[ri] === 'disc' && !canDiscount ? 'No discount permission' : undefined}
                      onClick={() => changeMode(modeRows[ri])}
                      className={`flex h-12 items-center justify-center rounded-xl text-sm font-bold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 ${
                        dialMode === modeRows[ri]
                          ? 'border-2 border-[#b20202] bg-white text-[#b20202]'
                          : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {modeLabels[modeRows[ri]]}
                    </button>
                  ) : (
                    <button
                      key="backspace"
                      type="button"
                      onClick={pushBackspace}
                      className="flex h-12 items-center justify-center rounded-xl border border-red-200 bg-red-100 text-red-600 transition-all hover:bg-red-200 active:scale-95"
                    >
                      ⌫
                    </button>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        {/* ── Payment button ── */}
        <button
          type="button"
          onClick={handleCheckout}
          disabled={items.length === 0}
          className="shrink-0 py-4 text-base font-bold text-white transition-colors disabled:opacity-40"
          style={{ backgroundColor: '#b20202' }}
        >
          Payment
        </button>
      </div>

      {/* Modals */}
      {showActions && (
        <ActionsModal
          onDiscount={() => setShowDiscount(true)}
          onNote={() => setShowNote(true)}
          onPricelist={() => setShowPricelist(true)}
          onCancelOrder={() => { clearCart(); setSelectedKey(null); setDialInput(''); }}
          onClose={() => setShowActions(false)}
        />
      )}

      {showPricelist && token && (
        <PricelistModal
          token={token}
          onClose={() => setShowPricelist(false)}
        />
      )}

      {showCustomer && (
        <CustomerModal
          current={customer}
          onSelect={handleSetCustomer}
          onClose={() => setShowCustomer(false)}
        />
      )}
    </>
  );
}

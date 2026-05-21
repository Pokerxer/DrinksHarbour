'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { EmptyProductBoxIcon, Text } from 'rizzui';
import {
  PiPlus, PiMinus, PiUser, PiNotePencil, PiX, PiMagnifyingGlass,
  PiTag, PiNote, PiArrowCounterClockwise, PiTrash,
  PiBarcode, PiStar, PiList, PiLinkSimple,
  PiCheckCircle, PiSpinner, PiPencilSimple,
  PiTicket, PiLightning, PiShoppingCart, PiWarning,
  PiCoins, PiPercent,
} from 'react-icons/pi';
import {
  usePOSCart, usePOSUI, usePOSAuth, usePOSPricelist, usePOSAvailablePricelists,
  usePOSCombos,
  getBestBundle, getEffectiveBundlePrice,
  getBestBundleForItem, getEffectiveBundlePriceForItem,
  computeItemPriceChain,
  computeRewardDiscount,

} from '@/app/shared/point-of-sale/store';
import type { CartAppliedReward } from '@/app/shared/point-of-sale/store';
import { POSCartItem, POSCombo } from '@/app/shared/point-of-sale/types';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';
import { posApi } from '@/app/shared/point-of-sale/api';
import toast from 'react-hot-toast';
import POSComboPicker from '@/app/shared/point-of-sale/components/pos-combo-picker';

// ── helpers ────────────────────────────────────────────────────────────────────
function itemKey(item: POSCartItem) {
  const base = item.sizeId ? `${item.subProductId}_${item.sizeId}` : item.subProductId;
  return item.comboRef?.instanceId ? `${base}__ci_${item.comboRef.instanceId}` : base;
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

// ── Rewards modal ─────────────────────────────────────────────────────────────
function RewardsModal({ onClose }: { onClose: () => void }) {
  const { items, total, subtotal, discountAmount, appliedRewards, addReward, removeReward, setDiscount } = usePOSCart();
  const { tenant } = usePOSAuth();
  const { selectedPricelist } = usePOSPricelist();
  const posSettings = tenant?.posSettings;

  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');

  const now     = new Date();
  const cartQty = items.reduce((s, i) => s + i.quantity, 0);

  // ── Helper: is a reward already applied? ──────────────────────────────────
  const appliedIds = new Set(appliedRewards.map(r => r.id));

  function toggle(reward: CartAppliedReward) {
    if (appliedIds.has(reward.id)) removeReward(reward.id);
    else                           addReward(reward);
  }

  // ── Resolve reward fields from a coupon / discount code ──────────────────
  function codeToReward(item: any, kind: 'coupon' | 'discount_code'): CartAppliedReward {
    return {
      id:          item.code,
      kind,
      name:        item.name,
      code:        item.code,
      color:       item.color ?? (kind === 'coupon' ? '#1d4ed8' : '#059669'),
      discType:    item.reward?.discountType  ?? item.type,
      discValue:   item.reward?.discountValue ?? item.value,
      applyOn:     item.reward?.applyOn       ?? 'order',
      maxDiscount: item.reward?.maxDiscount   ?? 0,
      detail:      item.reward?.discountType === 'pct' || item.type === 'pct'
                     ? `${item.reward?.discountValue ?? item.value}% off`
                     : `₦${formatCurrency(item.reward?.discountValue ?? item.value)} off`,
    };
  }

  function validateAndApplyCode() {
    const upper = codeInput.trim().toUpperCase();
    if (!upper) { setCodeError('Enter a code'); return; }

    for (const c of posSettings?.coupons ?? []) {
      if (!c.active || c.code.toUpperCase() !== upper) continue;
      if (c.availableOn && c.availableOn.pos === false) { setCodeError('Not valid at POS'); return; }
      if (c.validFrom && new Date(c.validFrom) > now)   { setCodeError('Not yet valid'); return; }
      if (c.validTo   && new Date(c.validTo)   < now)   { setCodeError('Expired'); return; }
      if ((c.maxUsage ?? 0) > 0 && (c.usageCount ?? 0) >= c.maxUsage!) { setCodeError('Usage limit reached'); return; }
      const minOrder = c.rules?.minOrderValue ?? c.minOrderValue ?? 0;
      if (minOrder > total)                { setCodeError(`Min. order ${formatCurrency(minOrder)} required`); return; }
      if ((c.rules?.minQty ?? 0) > cartQty){ setCodeError(`Min. ${c.rules?.minQty} items required`); return; }
      if (c.pricelistIds?.length && selectedPricelist && !c.pricelistIds.includes(selectedPricelist._id)) { setCodeError('Restricted to a different pricelist'); return; }
      addReward(codeToReward(c, 'coupon'));
      setCodeInput(''); setCodeError(''); return;
    }
    for (const d of posSettings?.discountCodes ?? []) {
      if (!d.active || d.code.toUpperCase() !== upper) continue;
      if (d.availableOn && d.availableOn.pos === false) { setCodeError('Not valid at POS'); return; }
      if (d.validFrom && new Date(d.validFrom) > now)   { setCodeError('Not yet valid'); return; }
      if (d.validTo   && new Date(d.validTo)   < now)   { setCodeError('Expired'); return; }
      if ((d.maxUsage ?? 0) > 0 && (d.usageCount ?? 0) >= d.maxUsage!) { setCodeError('Usage limit reached'); return; }
      const minOrder = d.rules?.minOrderValue ?? d.minOrderValue ?? 0;
      if (minOrder > total)                { setCodeError(`Min. order ${formatCurrency(minOrder)} required`); return; }
      if ((d.rules?.minQty ?? 0) > cartQty){ setCodeError(`Min. ${d.rules?.minQty} items required`); return; }
      if (d.pricelistIds?.length && selectedPricelist && !d.pricelistIds.includes(selectedPricelist._id)) { setCodeError('Restricted to a different pricelist'); return; }
      addReward(codeToReward(d, 'discount_code'));
      setCodeInput(''); setCodeError(''); return;
    }
    setCodeError('Code not found or inactive');
  }

  // ── Available promotions ──────────────────────────────────────────────────
  const availablePromos = (posSettings?.promotions ?? []).filter(p => {
    if (!p.active) return false;
    if (p.startDate && new Date(p.startDate) > now) return false;
    if (p.endDate   && new Date(p.endDate)   < now) return false;
    if (p.availableOn && p.availableOn.pos === false) return false;
    if ((p.rules?.minOrderValue ?? 0) > total) return false;
    if ((p.rules?.minQty ?? 0) > cartQty) return false;
    return true;
  });

  // ── Available BuyXGetY ────────────────────────────────────────────────────
  const availableBxgy = (posSettings?.buyXGetY ?? []).filter(b => {
    if (!b.active) return false;
    if (b.validFrom && new Date(b.validFrom) > now) return false;
    if (b.validTo   && new Date(b.validTo)   < now) return false;
    if (b.availableOn && b.availableOn.pos === false) return false;
    const pool = (b.buyProducts?.length ?? 0) > 0 ? items.filter(i => b.buyProducts!.includes(i.productId)) : items;
    return pool.reduce((s, i) => s + i.quantity, 0) >= b.buyQty;
  });

  // ── Loyalty ───────────────────────────────────────────────────────────────
  const loyaltyEnabled = posSettings?.loyaltyEnabled ?? false;
  const loyaltyPtsPerN = posSettings?.loyaltyPointsPerNaira ?? 0.01;
  const loyaltyPtVal   = posSettings?.loyaltyPointsValue    ?? 1;
  const maxRedPct      = posSettings?.loyaltyMaxRedemptionPct ?? 50;
  const minRedeem      = posSettings?.loyaltyCard?.minRedemption ?? 0;
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const earnedPts   = Math.round(total / 100 * loyaltyPtsPerN * 100);
  const maxRedeem   = Math.round(total * maxRedPct / 100);
  const redeemValue = Math.min(Math.round(loyaltyPoints * loyaltyPtVal), maxRedeem);
  const canRedeem   = loyaltyEnabled && loyaltyPoints >= minRedeem && redeemValue > 0;
  const loyaltyApplied = appliedIds.has('loyalty');

  function toggleLoyalty() {
    if (loyaltyApplied) {
      removeReward('loyalty');
    } else {
      if (!canRedeem) return;
      addReward({
        id: 'loyalty', kind: 'loyalty', name: 'Loyalty Redemption',
        color: '#d97706', discType: 'fixed', discValue: redeemValue,
        applyOn: 'order', maxDiscount: 0,
        detail: `₦${formatCurrency(redeemValue)} redeemed (${loyaltyPoints} pts)`,
      });
    }
  }

  // ── Discount programs ─────────────────────────────────────────────────────
  const activePrograms = (posSettings?.discountPrograms ?? []).filter(d => d.active);
  const noOptions = activePrograms.length === 0 && availablePromos.length === 0 && availableBxgy.length === 0 && !loyaltyEnabled;

  // Compute live discount for each applied reward to show in the header summary
  // Base for reward computation = subtotal after the manual cart-level discount
  const postCartDiscBase = Math.max(0, subtotal - discountAmount);
  const rewardsTotal = appliedRewards.reduce((s, r) => s + computeRewardDiscount(r, items, postCartDiscBase), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex w-full sm:max-w-lg flex-col overflow-hidden rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl max-h-[90vh]">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <PiStar className="h-5 w-5 text-[#b20202]" />
            <div>
              <p className="text-sm font-bold text-gray-900">Rewards & Discounts</p>
              {appliedRewards.length > 0 && (
                <p className="text-[11px] text-emerald-600 font-semibold">
                  {appliedRewards.length} applied · −{formatCurrency(rewardsTotal)}
                </p>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <PiX className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">

          {/* ── Coupon / Discount Code ── */}
          <div className="px-5 py-4 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Coupon or Discount Code</p>
            {/* Applied codes */}
            {appliedRewards.filter(r => r.kind === 'coupon' || r.kind === 'discount_code').map(r => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <PiCheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm font-bold text-emerald-800 tracking-widest">{r.code}</p>
                  <p className="text-[11px] text-emerald-600">{r.name} · −{formatCurrency(computeRewardDiscount(r, items, total))}</p>
                </div>
                <button type="button" onClick={() => removeReward(r.id)}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-200 text-emerald-700 hover:bg-emerald-300">
                  <PiX className="h-3 w-3" />
                </button>
              </div>
            ))}
            {/* Code input */}
            <div className="flex gap-2">
              <input value={codeInput} onChange={e => { setCodeInput(e.target.value.toUpperCase()); setCodeError(''); }}
                onKeyDown={e => e.key === 'Enter' && validateAndApplyCode()}
                placeholder="Enter coupon or discount code"
                className={`flex-1 rounded-xl border px-3.5 py-2.5 font-mono text-sm font-bold uppercase tracking-widest outline-none transition-colors
                  ${codeError ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-[#b20202]'}`} />
              <button type="button" onClick={validateAndApplyCode} disabled={!codeInput.trim()}
                className="flex items-center gap-1.5 rounded-xl bg-[#b20202] px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-40">
                <PiTicket className="h-4 w-4" /> Apply
              </button>
            </div>
            {codeError && (
              <p className="flex items-center gap-1 text-xs text-red-500">
                <PiWarning className="h-3.5 w-3.5 shrink-0" /> {codeError}
              </p>
            )}
          </div>

          {/* ── Discount programs ── */}
          {activePrograms.length > 0 && (
            <div className="px-5 py-4">
              <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Preset Discounts</p>
              <div className="space-y-2">
                {activePrograms.map(dp => {
                  const rid = `dp_${dp._id ?? dp.name}`;
                  const applied = appliedIds.has(rid);
                  const reward: CartAppliedReward = {
                    id: rid, kind: 'discount_program', name: dp.name, color: dp.color,
                    discType: dp.type === 'pct' ? 'pct' : 'fixed', discValue: dp.value,
                    applyOn: 'order', maxDiscount: 0,
                    detail: dp.type === 'pct' ? `${dp.value}%` : `₦${formatCurrency(dp.value)}`,
                  };
                  const disc = computeRewardDiscount(reward, items, total);
                  return (
                    <button key={rid} type="button" onClick={() => toggle(reward)}
                      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors
                        ${applied ? 'border-[#b20202]/40 bg-red-50 ring-1 ring-[#b20202]/30' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        {applied
                          ? <PiCheckCircle className="h-4 w-4 shrink-0 text-[#b20202]" />
                          : <div className="h-4 w-4 shrink-0 rounded-full border-2 border-gray-300" />}
                        <div className="min-w-0">
                          <p className={`text-sm font-bold truncate ${applied ? 'text-[#b20202]' : 'text-gray-800'}`}>{dp.name}</p>
                          {dp.description && <p className="text-[10px] text-gray-400 truncate">{dp.description}</p>}
                        </div>
                      </div>
                      <div className="ml-3 shrink-0 text-right">
                        <span className={`rounded-lg px-2.5 py-1 text-xs font-black ${applied ? 'bg-[#b20202] text-white' : 'bg-gray-100 text-gray-700'}`}
                          style={!applied && dp.color ? { backgroundColor: `${dp.color}18`, color: dp.color } : undefined}>
                          {dp.type === 'pct' ? `${dp.value}%` : `₦${formatCurrency(dp.value)}`}
                        </span>
                        {applied && <p className="mt-0.5 text-[10px] text-[#b20202] font-semibold">−{formatCurrency(disc)}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Promotions ── */}
          {availablePromos.length > 0 && (
            <div className="px-5 py-4">
              <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Available Promotions</p>
              <div className="space-y-2">
                {availablePromos.map(p => {
                  const color   = p.color || '#d97706';
                  const applied = appliedIds.has(p._id!);
                  const reward: CartAppliedReward = {
                    id:          p._id!,
                    kind:        'promotion',
                    name:        p.name,
                    color,
                    discType:    (p.reward?.discountType  ?? p.type)  as 'pct' | 'fixed',
                    discValue:   p.reward?.discountValue  ?? p.value,
                    applyOn:     (p.reward?.applyOn       ?? 'order') as CartAppliedReward['applyOn'],
                    maxDiscount: p.reward?.maxDiscount    ?? 0,
                    detail:      p.description,
                  };
                  const disc = computeRewardDiscount(reward, items, total);
                  return (
                    <button key={p._id} type="button" onClick={() => toggle(reward)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors
                        ${applied ? 'ring-1' : 'border-gray-200 hover:opacity-90'}`}
                      style={applied ? { borderColor: `${color}60`, backgroundColor: `${color}12`, outlineColor: color } : { borderColor: `${color}30`, backgroundColor: `${color}08` }}>
                      {applied
                        ? <PiCheckCircle className="h-4 w-4 shrink-0" style={{ color }} />
                        : <PiLightning className="h-4 w-4 shrink-0" style={{ color }} />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{p.name}</p>
                        {p.description && <p className="text-[10px] text-gray-400">{p.description}</p>}
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="rounded-lg px-2.5 py-1 text-xs font-black text-white" style={{ backgroundColor: color }}>
                          {reward.discType === 'pct' ? `${reward.discValue}% off` : `₦${formatCurrency(reward.discValue ?? 0)} off`}
                        </span>
                        {applied && <p className="mt-0.5 text-[10px] font-semibold" style={{ color }}>−{formatCurrency(disc)}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Buy X Get Y ── */}
          {availableBxgy.length > 0 && (
            <div className="px-5 py-4">
              <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Buy X Get Y</p>
              <div className="space-y-2">
                {availableBxgy.map(b => {
                  const color   = b.color || '#7c3aed';
                  const applied = appliedIds.has(b._id!);
                  const reward: CartAppliedReward = {
                    id:             b._id!,
                    kind:           'bxgy',
                    name:           b.name,
                    color,
                    buyQty:         b.buyQty,
                    getQty:         b.getQty,
                    getDiscountPct: b.getDiscountPct,
                    buyProducts:    b.buyProducts,
                    getProducts:    b.getProducts,
                  };
                  const disc = computeRewardDiscount(reward, items, total);
                  return (
                    <button key={b._id} type="button" onClick={() => toggle(reward)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors
                        ${applied ? 'ring-1' : 'border-gray-200 hover:opacity-90'}`}
                      style={applied ? { borderColor: `${color}60`, backgroundColor: `${color}12` } : { borderColor: `${color}30`, backgroundColor: `${color}08` }}>
                      {applied
                        ? <PiCheckCircle className="h-4 w-4 shrink-0" style={{ color }} />
                        : <PiShoppingCart className="h-4 w-4 shrink-0" style={{ color }} />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{b.name}</p>
                        <p className="text-[10px] text-gray-400">
                          Buy {b.buyQty} get {b.getQty} {b.getDiscountPct === 100 ? 'free' : `at ${b.getDiscountPct}% off`}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="rounded-lg px-2.5 py-1 text-xs font-black text-white" style={{ backgroundColor: color }}>
                          −{formatCurrency(disc)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Loyalty ── */}
          {loyaltyEnabled && (
            <div className="px-5 py-4">
              <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Loyalty Points</p>
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <PiCoins className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-semibold text-gray-700">Customer points balance</span>
                  </div>
                  <input type="number" min={0} value={loyaltyPoints || ''}
                    onChange={e => { setLoyaltyPoints(parseInt(e.target.value) || 0); if (loyaltyApplied) removeReward('loyalty'); }}
                    placeholder="0"
                    className="w-24 rounded-xl border border-amber-200 bg-white px-3 py-1.5 text-center text-sm font-bold outline-none focus:border-[#d97706]" />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-white px-3 py-2 border border-amber-100">
                    <p className="text-gray-400">Earns this order</p>
                    <p className="font-bold text-amber-700">+{earnedPts} pts</p>
                  </div>
                  <div className="rounded-lg bg-white px-3 py-2 border border-amber-100">
                    <p className="text-gray-400">Can redeem (max {maxRedPct}%)</p>
                    <p className={`font-bold ${canRedeem ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {loyaltyPoints >= minRedeem ? `₦${formatCurrency(redeemValue)}` : `Need ${minRedeem} pts min`}
                    </p>
                  </div>
                </div>
                {canRedeem && (
                  <button type="button" onClick={toggleLoyalty}
                    className={`w-full rounded-xl py-2.5 text-sm font-bold transition-colors
                      ${loyaltyApplied ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'text-white hover:opacity-90'}`}
                    style={loyaltyApplied ? undefined : { backgroundColor: '#d97706' }}>
                    {loyaltyApplied
                      ? `✓ ₦${formatCurrency(redeemValue)} applied — click to remove`
                      : `Apply ₦${formatCurrency(redeemValue)} loyalty discount`}
                  </button>
                )}
              </div>
            </div>
          )}

          {noOptions && (
            <div className="px-5 py-10 text-center">
              <PiStar className="mx-auto h-10 w-10 text-gray-200 mb-2" />
              <p className="text-sm text-gray-500 font-medium">No rewards available</p>
              <p className="text-xs text-gray-400 mt-1">Configure discount programs and promotions in POS settings</p>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-gray-100 px-5 py-4">
          <button type="button" onClick={onClose}
            className="w-full rounded-xl py-2.5 text-sm font-bold text-white hover:opacity-90"
            style={{ backgroundColor: '#b20202' }}>
            Done{appliedRewards.length > 0 ? ` · ${appliedRewards.length} reward${appliedRewards.length > 1 ? 's' : ''} applied` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Actions modal ─────────────────────────────────────────────────────────────
function ActionsModal({
  onDiscount,
  onNote,
  onPricelist,
  onCancelOrder,
  onReward,
  onClose,
}: {
  onDiscount: () => void;
  onNote: () => void;
  onPricelist: () => void;
  onCancelOrder: () => void;
  onReward: () => void;
  onClose: () => void;
}) {
  const { selectedPricelist } = usePOSPricelist();
  const { appliedRewards: _ar } = usePOSCart();

  type Action = { label: string; icon: React.ReactNode; fn: (() => void) | null; active?: boolean; danger?: boolean };
  const actions: Action[] = [
    { label: 'General Note',   icon: <PiNote className="h-5 w-5" />,               fn: () => { onNote(); onClose(); } },
    { label: 'Quotation/Order',icon: <PiLinkSimple className="h-5 w-5" />,          fn: null },
    { label: 'Reward',         icon: <PiStar className="h-5 w-5" />,                fn: () => { onReward(); onClose(); }, active: _ar.length > 0 },
    { label: 'Discount',       icon: <PiPercent className="h-5 w-5" />,             fn: () => { onDiscount(); onClose(); } },
    { label: 'Customer Note',  icon: <PiNote className="h-5 w-5" />,                fn: () => { onNote(); onClose(); } },
    { label: selectedPricelist ? selectedPricelist.name : 'Price List', icon: <PiList className="h-5 w-5" />, fn: () => { onPricelist(); onClose(); }, active: !!selectedPricelist },
    { label: 'Refund',         icon: <PiArrowCounterClockwise className="h-5 w-5" />, fn: null },
    { label: 'Cancel Order',   icon: <PiTrash className="h-5 w-5" />,               fn: () => { onCancelOrder(); onClose(); }, danger: true },
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
                  : a.danger
                  ? 'bg-red-50 text-red-600 hover:bg-red-100'
                  : a.active
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
    removeComboGroup,
    setComboGroupQty,
    replaceComboGroup,
    updateQuantity,
    updateItemDiscount,
    updateItemPrice,
    clearCart,
    setDiscount,
    setNote,
    setCustomer,
    appliedRewards,
    removeReward,
    rewardsDiscountTotal,
  } = usePOSCart();

  const { setActiveView } = usePOSUI();
  const { staff, token } = usePOSAuth();
  const { selectedPricelist, setSelectedPricelist } = usePOSPricelist();
  const { combos, setCombos } = usePOSCombos();
  const staffPerms: string[] = staff?.posPermissions ?? [];
  const canDiscount = staffPerms.includes('pos:discount');
  const canRefund   = staffPerms.includes('pos:refund');

  // Edit combo state
  type EditComboState = {
    combo: POSCombo;
    instanceId: string;
    groupItems: POSCartItem[];
    initialPicks: Record<number, Record<number, { val: string | true; qty: number }>>;
  };
  const [editingCombo, setEditingCombo] = useState<EditComboState | null>(null);
  const [loadingEdit,  setLoadingEdit]  = useState<string | null>(null); // instanceId being loaded

  // UI state
  const [showActions,   setShowActions]   = useState(false);
  const [showCustomer,  setShowCustomer]  = useState(false);
  const [showNote,      setShowNote]      = useState(false);
  const [showDiscount,  setShowDiscount]  = useState(false);
  const [showPricelist, setShowPricelist] = useState(false);
  const [showRewards,   setShowRewards]   = useState(false);

  // Dialpad state
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [dialMode, setDialMode] = useState<DialMode>('qty');
  const [dialInput, setDialInput] = useState('');

  // Per-item BXGY discount map — merged across all active BXGY rewards
  // Key: `${subProductId}_${sizeId ?? ''}`
  // When switching carts, reset dialpad selection
  const prevCartIdRef = useRef(activeCartId);
  if (prevCartIdRef.current !== activeCartId) {
    prevCartIdRef.current = activeCartId;
    // reset without triggering re-render — handled by useEffect below
  }

  const selectedItem = items.find((i) => itemKey(i) === selectedKey) ?? null;

  function getInitialInput(_item: POSCartItem, _mode: DialMode) {
    return '';
  }

  function selectItem(item: POSCartItem) {
    if (item.bxgyRef) return; // BXGY items are managed by the reward toggle
    const key = itemKey(item);
    setSelectedKey(key);
    setDialInput(getInitialInput(item, dialMode));
  }

  function applyDial(input: string, mode: DialMode, item: POSCartItem) {
    const num = parseFloat(input) || 0;
    const ci  = item.comboRef?.instanceId;
    if (mode === 'qty')   updateQuantity(item.subProductId, Math.max(1, Math.round(num)), item.sizeId, ci);
    if (mode === 'disc')  updateItemDiscount(item.subProductId, num, item.sizeId, ci);
    if (mode === 'price') updateItemPrice(item.subProductId, num, item.sizeId, ci);
  }

  const pushDigit = useCallback((d: string) => {
    if (!selectedItem) return;
    let next: string;
    if (d === '.') {
      next = dialInput.includes('.') ? dialInput : (dialInput || '') + '.';
    } else {
      // Empty or "0" means start fresh (first digit replaces).
      // Otherwise append so multi-digit values like "15" work.
      next = (!dialInput || dialInput === '0') ? d : dialInput.length >= 8 ? dialInput : dialInput + d;
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

  async function handleEditCombo(instanceId: string, comboId: string, groupItems: POSCartItem[]) {
    // Find the full combo definition — use cached atom first, fetch if missing
    let combo = combos.find(c => String(c._id) === String(comboId));
    if (!combo && token) {
      setLoadingEdit(instanceId);
      try {
        const data = await posApi.getCombos(token);
        setCombos(data.combos || []);
        combo = (data.combos || []).find(c => String(c._id) === String(comboId));
      } catch {
        toast.error('Could not load combo details');
        return;
      } finally {
        setLoadingEdit(null);
      }
    }
    if (!combo) { toast.error('Combo not found — it may have been deleted'); return; }

    // Rebuild picks from current cart items
    const initialPicks: Record<number, Record<number, { val: string | true; qty: number }>> = {};
    combo.choiceLines.forEach((line, li) => {
      line.items.forEach((item, ii) => {
        const spId = String(item.subProduct?._id ?? '');
        const cartItem = groupItems.find(ci =>
          String(ci.subProductId) === spId &&
          (ci.sizeId
            ? (!item.allowedSizes?.length || item.allowedSizes.map(String).includes(ci.sizeId))
            : true)
        );
        if (cartItem) {
          if (!initialPicks[li]) initialPicks[li] = {};
          initialPicks[li][ii] = { val: cartItem.sizeId ?? true, qty: cartItem.quantity };
        }
      });
    });

    setEditingCombo({ combo, instanceId, groupItems, initialPicks });
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

  // ── Cart item row renderer (shared for regular + combo items) ─────────────
  function renderCartItem(item: POSCartItem, isComboChild: boolean) {
    const key        = itemKey(item);
    const isSelected = selectedKey === key;
    const ci         = item.comboRef?.instanceId;
    const isBxgy     = !!item.bxgyRef;

    const bestBundle = selectedPricelist
      ? getBestBundleForItem(item, selectedPricelist)
      : getBestBundle(item);
    const { price: effectivePrice, overrides: bundleOverrides } = selectedPricelist
      ? getEffectiveBundlePriceForItem(item, selectedPricelist)
      : getEffectiveBundlePrice(item);
    const lineGross   = effectivePrice * item.quantity;
    const itemDiscAmt = lineGross * Math.max(0, Math.min(100, item.discount)) / 100;
    let bundleDiscAmt = 0;
    if (bestBundle && !bundleOverrides) {
      const dt = bestBundle.discountType ?? 'percentage';
      bundleDiscAmt = dt === 'fixed'
        ? Math.max(0, Math.min((bestBundle.discount ?? 0) * item.quantity, lineGross - itemDiscAmt))
        : Math.max(0, lineGross * Math.min(100, bestBundle.discount ?? 0) / 100);
    }
    const lineTotal    = Math.max(0, lineGross - itemDiscAmt - bundleDiscAmt);
    const bundleActive = bestBundle && (bundleDiscAmt > 0 || bundleOverrides);

    const bundleLabel = bundleActive ? (() => {
      const dt   = bestBundle!.discountType ?? 'percentage';
      const name = bestBundle!.name ? ` (${bestBundle!.name})` : '';
      if (dt === 'markup_on_cost')  return `📦 Bundle${name}: Cost +${bestBundle!.discount ?? 0}% → ${formatCurrency(effectivePrice)}/unit`;
      if (dt === 'no_discount')     return `📦 Bundle${name}: No discount → ${formatCurrency(effectivePrice)}/unit`;
      if (dt === 'fixed')           return `📦 Bundle${name}: -${formatCurrency((bestBundle!.discount ?? 0) * item.quantity)}`;
      return `📦 Bundle${name}: -${bestBundle!.discount ?? 0}%`;
    })() : null;

    const qtyDisplay = isSelected && dialMode === 'qty' && dialInput !== ''
      ? dialInput
      : String(item.quantity);

    // ── BXGY free-product line ─────────────────────────────────────────────────
    if (isBxgy) {
      const origPrice  = item.bxgyRef!.originalPrice;
      const discPct    = item.bxgyRef!.discPct;
      const unitSaving = origPrice * (discPct / 100);  // per-unit discount amount
      const lineSaving = unitSaving * item.quantity;
      const bxgyColor  = item.bxgyRef!.rewardColor ?? '#059669';
      const isFree     = discPct === 100;

      return (
        <div
          key={key}
          className="w-full border-b border-gray-100 px-4 py-3 border-l-4"
          style={{ borderLeftColor: `${bxgyColor}60`, backgroundColor: `${bxgyColor}06` }}
        >
          {/* Row 1: "Free Product - Name" + negative total */}
          <div className="flex items-start justify-between gap-2">
            <span className="flex-1 text-sm font-semibold italic leading-tight" style={{ color: bxgyColor }}>
              {isFree ? 'Free Product' : `Discounted (${discPct}% off)`} - {item.name}
              {item.variant ? ` - ${item.variant}` : ''}
            </span>
            <span className="shrink-0 text-sm font-bold tabular-nums" style={{ color: bxgyColor }}>
              -{formatCurrency(lineSaving)}
            </span>
          </div>
          {/* Row 2: qty × -price + remove reward */}
          <div className="mt-1 flex items-center gap-1.5 text-xs" style={{ color: `${bxgyColor}cc` }}>
            <span className="inline-block rounded border px-1.5 py-0.5 font-semibold tabular-nums"
              style={{ borderColor: `${bxgyColor}40`, backgroundColor: 'white' }}>
              {item.quantity}
            </span>
            <span>×</span>
            <span className="font-semibold tabular-nums">-{formatCurrency(unitSaving)}</span>
            <span>/ Units</span>
            <span
              role="button"
              tabIndex={0}
              title={`Remove "${item.bxgyRef!.rewardName ?? 'BXGY'}" offer`}
              onClick={(e) => { e.stopPropagation(); removeReward(item.bxgyRef!.rewardId); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); removeReward(item.bxgyRef!.rewardId); }
              }}
              className="ml-auto cursor-pointer opacity-50 hover:opacity-100 transition-opacity"
              style={{ color: bxgyColor }}
            >
              <PiX className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      );
    }

    // ── Regular item row ───────────────────────────────────────────────────────
    return (
      <button
        key={key}
        type="button"
        onClick={() => selectItem(item)}
        className={`w-full border-b border-gray-100 text-left transition-colors
          ${isComboChild ? 'pl-6 pr-4 py-2.5' : 'px-4 py-3'}
          ${isSelected ? 'bg-red-50 border-l-4 border-l-[#b20202]' : 'hover:bg-gray-50 border-l-4 border-l-transparent'}
        `}
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
        {/* Row 2: qty × price + remove */}
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
            {Math.abs(effectivePrice - item.price) > 0.001 && (
              <span className="ml-1 font-normal text-gray-400 line-through text-[10px]">{formatCurrency(item.price)}</span>
            )}
          </span>
          <span>/ Units</span>
          {item.discount > 0 && (
            <span className="ml-1 rounded bg-red-50 px-1.5 text-[#b20202]">-{item.discount}%</span>
          )}
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              removeItem(item.subProductId, item.sizeId, ci);
              if (selectedKey === key) { setSelectedKey(null); setDialInput(''); }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                removeItem(item.subProductId, item.sizeId, ci);
                if (selectedKey === key) { setSelectedKey(null); setDialInput(''); }
              }
            }}
            className="ml-auto cursor-pointer text-gray-300 hover:text-red-500"
          >
            <PiX className="h-3.5 w-3.5" />
          </span>
        </div>
        {bundleLabel && (
          <div className="mt-1 flex items-center justify-between rounded-md bg-purple-50 px-2 py-1 text-[10px] font-semibold text-purple-700">
            <span>{bundleLabel}</span>
            <span className="tabular-nums">-{formatCurrency(bundleDiscAmt)}</span>
          </div>
        )}
      </button>
    );
  }

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
              {(() => {
                // Build display groups: regular items are standalone; combo items are
                // collected under a shared group header keyed by instanceId.
                type DisplayEntry =
                  | { kind: 'item';  item: POSCartItem }
                  | { kind: 'combo'; instanceId: string; comboName: string; groupItems: POSCartItem[] };

                const seen = new Set<string>();
                const entries: DisplayEntry[] = [];

                for (const item of items) {
                  if (item.comboRef?.instanceId) {
                    const { instanceId, comboName } = item.comboRef;
                    if (!seen.has(instanceId)) {
                      seen.add(instanceId);
                      entries.push({
                        kind: 'combo',
                        instanceId,
                        comboName,
                        groupItems: items.filter(i => i.comboRef?.instanceId === instanceId),
                      });
                    }
                  } else {
                    entries.push({ kind: 'item', item });
                  }
                }

                return entries.map((entry) => {
                  if (entry.kind === 'combo') {
                    const { instanceId, comboName, groupItems } = entry;
                    const comboTotal = groupItems.reduce((s, i) => s + i.price * i.quantity, 0);
                    const anySelected = groupItems.some(i => selectedKey === itemKey(i));

                    // combo qty = first item's quantity (all items in group are same qty)
                    const comboQty     = groupItems[0]?.quantity ?? 1;
                    const comboId      = groupItems[0]?.comboRef?.comboId ?? '';
                    const isLoadingThis = loadingEdit === instanceId;

                    return (
                      <div key={instanceId} className={`border-b border-gray-100 ${anySelected ? 'bg-red-50/30' : ''}`}>
                        {/* Combo group header */}
                        <div className="flex items-center gap-2 border-b border-[#b20202]/15 bg-[#b20202]/6 px-3 py-2">
                          {/* Name + item count */}
                          <div className="flex min-w-0 flex-1 items-center gap-1.5">
                            <span className="text-[10px]">🎁</span>
                            <span className="truncate text-xs font-bold text-[#b20202]">{comboName}</span>
                          </div>

                          {/* Qty control */}
                          <div className="flex shrink-0 items-center rounded-lg border border-[#b20202]/20 bg-white overflow-hidden">
                            <button
                              type="button"
                              onClick={() => {
                                if (comboQty <= 1) {
                                  removeComboGroup(instanceId);
                                  if (anySelected) { setSelectedKey(null); setDialInput(''); }
                                } else {
                                  setComboGroupQty(instanceId, comboQty - 1);
                                }
                              }}
                              className="flex h-6 w-6 items-center justify-center text-[#b20202] hover:bg-[#b20202]/10 transition-colors"
                            >
                              <PiMinus className="h-3 w-3" />
                            </button>
                            <span className="min-w-[20px] text-center text-xs font-bold text-gray-800">
                              {comboQty}
                            </span>
                            <button
                              type="button"
                              onClick={() => setComboGroupQty(instanceId, comboQty + 1)}
                              className="flex h-6 w-6 items-center justify-center text-[#b20202] hover:bg-[#b20202]/10 transition-colors"
                            >
                              <PiPlus className="h-3 w-3" />
                            </button>
                          </div>

                          {/* Total (comboTotal already includes item.quantity) */}
                          <span className="shrink-0 text-xs font-bold text-gray-800">
                            {formatCurrency(comboTotal)}
                          </span>

                          {/* Edit button */}
                          <button
                            type="button"
                            title="Edit combo choices"
                            disabled={isLoadingThis}
                            onClick={() => handleEditCombo(instanceId, comboId, groupItems)}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#b20202]/60 hover:bg-[#b20202]/10 hover:text-[#b20202] transition-colors disabled:opacity-40"
                          >
                            {isLoadingThis
                              ? <PiSpinner className="h-3.5 w-3.5 animate-spin" />
                              : <PiPencilSimple className="h-3.5 w-3.5" />
                            }
                          </button>

                          {/* Remove button */}
                          <button
                            type="button"
                            title="Remove combo"
                            onClick={() => {
                              removeComboGroup(instanceId);
                              if (anySelected) { setSelectedKey(null); setDialInput(''); }
                            }}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                          >
                            <PiX className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Individual combo items */}
                        {groupItems.map(item => renderCartItem(item, true))}
                      </div>
                    );
                  }

                  return renderCartItem(entry.item, false);
                });
              })()}
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
                      {steps.map((s, i) => {
                        const totalAdj = s.saving * item.quantity;
                        const isSaving = totalAdj > 0;
                        return (
                          <span key={i} className={`rounded px-1.5 py-0.5 font-semibold ${isSaving ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                            {s.label}: {isSaving ? '-' : '+'}{formatCurrency(Math.abs(totalAdj))}
                          </span>
                        );
                      })}
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
          {/* BXGY rewards are shown as "Free Product" lines in the item list — skip here */}
          {appliedRewards.filter(r => r.kind !== 'bxgy').map(r => (
            <div key={r.id} className="mb-0.5 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 truncate min-w-0"
                style={{ color: r.color ?? '#b20202' }}>
                <PiStar className="h-3 w-3 shrink-0" />
                <span className="truncate font-semibold">{r.name}</span>
                {r.code && <span className="font-mono font-bold tracking-wider">({r.code})</span>}
              </span>
              <span className="flex items-center gap-1 shrink-0 ml-2">
                <span className="font-bold" style={{ color: r.color ?? '#b20202' }}>
                  -{formatCurrency(computeRewardDiscount(r, items, Math.max(0, subtotal - discountAmount)))}
                </span>
                <button type="button" onClick={() => removeReward(r.id)}
                  className="text-gray-300 hover:text-red-400 transition-colors">
                  <PiX className="h-3 w-3" />
                </button>
              </span>
            </div>
          ))}
          <div className="flex items-baseline justify-between">
            <span className="text-base font-bold text-gray-900">Total</span>
            <span className={`text-lg font-bold ${selectedPricelist ? 'text-emerald-700' : 'text-gray-900'}`}>
              {formatCurrency(total)}
            </span>
          </div>
        </div>

        {/* ── Action bar ── */}
        <div className="shrink-0 grid grid-cols-4 gap-px border-t border-gray-200 bg-gray-200">
          <button
            type="button"
            onClick={() => setShowCustomer(true)}
            className={`flex items-center justify-center gap-1 bg-white py-2.5 text-[11px] font-medium transition-colors hover:bg-gray-50 ${
              hasCustomer ? 'text-[#b20202]' : 'text-gray-600'
            }`}
          >
            <PiUser className="h-3.5 w-3.5" />
            {hasCustomer ? customerLabel.split(' ')[0] : 'Customer'}
          </button>
          <button
            type="button"
            onClick={() => setShowNote(!showNote)}
            className={`flex items-center justify-center gap-1 bg-white py-2.5 text-[11px] font-medium transition-colors hover:bg-gray-50 ${
              note ? 'text-[#b20202]' : 'text-gray-600'
            }`}
          >
            <PiNotePencil className="h-3.5 w-3.5" />
            Note
          </button>
          <button
            type="button"
            onClick={() => setShowRewards(true)}
            className={`relative flex items-center justify-center gap-1 bg-white py-2.5 text-[11px] font-medium transition-colors hover:bg-gray-50 ${
              appliedRewards.length > 0 ? 'text-[#b20202]' : 'text-gray-600'
            }`}
          >
            <PiStar className="h-3.5 w-3.5" />
            Rewards{appliedRewards.length > 0 ? ` (${appliedRewards.length})` : ''}
            {appliedRewards.length > 0 && (
              <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-[#b20202]" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowActions(true)}
            className="flex items-center justify-center gap-1 bg-white py-2.5 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
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
          onReward={() => setShowRewards(true)}
          onCancelOrder={() => { clearCart(); setSelectedKey(null); setDialInput(''); }}
          onClose={() => setShowActions(false)}
        />
      )}

      {showRewards && (
        <RewardsModal onClose={() => setShowRewards(false)} />
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

      {/* Edit combo picker */}
      {editingCombo && (
        <POSComboPicker
          combo={editingCombo.combo}
          initialPicks={editingCombo.initialPicks}
          editInstanceId={editingCombo.instanceId}
          onClose={() => setEditingCombo(null)}
          onAdd={(newItems) => {
            replaceComboGroup(editingCombo.instanceId, newItems);
            setEditingCombo(null);
            toast.success('Combo updated', { icon: '🎁' });
          }}
        />
      )}
    </>
  );
}

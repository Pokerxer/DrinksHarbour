'use client';

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from 'react';
import Image from 'next/image';
import { EmptyProductBoxIcon, Text } from 'rizzui';
import {
  PiPlus,
  PiMinus,
  PiUser,
  PiNotePencil,
  PiX,
  PiMagnifyingGlass,
  PiTag,
  PiNote,
  PiArrowCounterClockwise,
  PiTrash,
  PiBarcode,
  PiStar,
  PiList,
  PiLinkSimple,
  PiCheckCircle,
  PiSpinner,
  PiPencilSimple,
  PiTicket,
  PiLightning,
  PiShoppingCart,
  PiWarning,
  PiCoins,
  PiPercent,
} from 'react-icons/pi';
import {
  usePOSCart,
  usePOSUI,
  usePOSAuth,
  usePOSPricelist,
  usePOSAvailablePricelists,
  usePOSCombos,
  usePOSProducts,
  getBestBundle,
  getEffectiveBundlePrice,
  getBestBundleForItem,
  getEffectiveBundlePriceForItem,
  computeItemPriceChain,
  computeRewardDiscount,
  itemMatchesApplicableItems,
  usePOSSettings,
  usePOSWarehouse,
  usePOSAvailableWarehouses,
  usePOSLinkedSalesOrder,
} from '@/app/shared/point-of-sale/store';
import type { CartAppliedReward } from '@/app/shared/point-of-sale/store';
import {
  POSCartItem,
  POSCombo,
  POSCustomer,
} from '@/app/shared/point-of-sale/types';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';
import { posApi } from '@/app/shared/point-of-sale/api';
import toast from 'react-hot-toast';
import POSComboPicker from '@/app/shared/point-of-sale/components/pos-combo-picker';
import POSOrderPickerModal from '@/app/shared/point-of-sale/components/pos-order-picker-modal';

// ── helpers ────────────────────────────────────────────────────────────────────
function itemKey(item: POSCartItem) {
  const base = item.sizeId
    ? `${item.subProductId}_${item.sizeId}`
    : item.subProductId;
  if (item.comboRef?.instanceId)
    return `${base}__ci_${item.comboRef.instanceId}`;
  if (item.bxgyRef?.rewardId)
    return `${base}__bxgy_${item.bxgyRef.rewardId}_${item.bxgyRef.role}`;
  return base;
}

type DialMode = 'qty' | 'disc' | 'price';

// ── Pricelist modal ────────────────────────────────────────────────────────────
function PricelistModal({
  token,
  onClose,
}: {
  token: string;
  onClose: () => void;
}) {
  const { selectedPricelist, setSelectedPricelist } = usePOSPricelist();
  const { pricelists, loaded, load } = usePOSAvailablePricelists();
  const loading = !loaded;

  useEffect(() => {
    if (token) load(token);
  }, [token, load]);

  function select(pl: any) {
    setSelectedPricelist(pl);
    if (pl) toast.success(`Pricelist applied: ${pl.name}`, { icon: '🏷️' });
    else toast('Standard pricing restored', { icon: '↩️' });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">
              Select Pricelist
            </h2>
            <p className="text-[11px] text-gray-400">
              Prices update immediately on the product grid
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
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
                  !selectedPricelist
                    ? 'font-semibold text-[#b20202]'
                    : 'text-gray-700'
                }`}
              >
                {!selectedPricelist ? (
                  <PiCheckCircle className="h-4 w-4 shrink-0 text-[#b20202]" />
                ) : (
                  <span className="h-4 w-4 shrink-0 rounded-full border-2 border-gray-300" />
                )}
                <span className="flex-1">Standard Price</span>
                <span className="text-[10px] text-gray-400">No override</span>
              </button>

              {pricelists.length > 0 && (
                <div className="mx-4 my-1 border-t border-gray-100" />
              )}

              {pricelists.length === 0 && !loading && (
                <p className="px-5 py-4 text-center text-xs text-gray-400">
                  No selectable pricelists configured.
                  <br />
                  <span className="text-gray-300">
                    Mark a pricelist as "Selectable" in the admin.
                  </span>
                </p>
              )}

              {pricelists.map((pl) => {
                const active = selectedPricelist?._id === pl._id;
                return (
                  <button
                    key={pl._id}
                    type="button"
                    onClick={() => select(pl)}
                    className={`flex w-full items-center gap-3 px-5 py-3.5 text-left text-sm transition-colors hover:bg-gray-50 ${
                      active
                        ? 'bg-[#b20202]/5 font-semibold text-[#b20202]'
                        : 'text-gray-700'
                    }`}
                  >
                    {active ? (
                      <PiCheckCircle className="h-4 w-4 shrink-0 text-[#b20202]" />
                    ) : (
                      <PiTag className="h-4 w-4 shrink-0 text-gray-300" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{pl.name}</p>
                      {pl.rules?.length > 0 && (
                        <p className="text-[10px] text-gray-400">
                          {pl.rules.length} rule
                          {pl.rules.length !== 1 ? 's' : ''}
                        </p>
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
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Rewards modal ─────────────────────────────────────────────────────────────
function RewardsModal({ onClose }: { onClose: () => void }) {
  const {
    items,
    total,
    subtotal,
    discountAmount,
    appliedRewards,
    addReward,
    removeReward,
    setDiscount,
    customer,
  } = usePOSCart();
  const { tenant } = usePOSAuth();
  const { selectedPricelist } = usePOSPricelist();
  const { products: posProducts } = usePOSProducts();
  const posSettings = tenant?.posSettings;

  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');

  const now = new Date();
  const cartQty = items.reduce((s, i) => s + i.quantity, 0);

  // ── Helper: is a reward already applied? ──────────────────────────────────
  const appliedIds = new Set(appliedRewards.map((r) => r.id));

  function toggle(reward: CartAppliedReward) {
    if (appliedIds.has(reward.id)) removeReward(reward.id);
    else addReward(reward);
  }

  // ── Resolve reward fields from a coupon / discount code ──────────────────
  function codeToReward(
    item: any,
    kind: 'coupon' | 'discount_code'
  ): CartAppliedReward {
    return {
      id: item.code,
      kind,
      name: item.name,
      code: item.code,
      color: item.color ?? (kind === 'coupon' ? '#1d4ed8' : '#059669'),
      discType: item.reward?.discountType ?? item.type,
      discValue: item.reward?.discountValue ?? item.value,
      applyOn: item.reward?.applyOn ?? 'order',
      maxDiscount: item.reward?.maxDiscount ?? 0,
      detail:
        item.reward?.discountType === 'pct' || item.type === 'pct'
          ? `${item.reward?.discountValue ?? item.value}% off`
          : `₦${formatCurrency(item.reward?.discountValue ?? item.value)} off`,
    };
  }

  function validateAndApplyCode() {
    const upper = codeInput.trim().toUpperCase();
    if (!upper) {
      setCodeError('Enter a code');
      return;
    }

    for (const c of posSettings?.coupons ?? []) {
      if (!c.active || c.code.toUpperCase() !== upper) continue;
      if (c.availableOn && c.availableOn.pos === false) {
        setCodeError('Not valid at POS');
        return;
      }
      if (c.validFrom && new Date(c.validFrom) > now) {
        setCodeError('Not yet valid');
        return;
      }
      if (c.validTo && new Date(c.validTo) < now) {
        setCodeError('Expired');
        return;
      }
      if ((c.maxUsage ?? 0) > 0 && (c.usageCount ?? 0) >= c.maxUsage!) {
        setCodeError('Usage limit reached');
        return;
      }
      const minOrder = c.rules?.minOrderValue ?? c.minOrderValue ?? 0;
      if (minOrder > total) {
        setCodeError(`Min. order ${formatCurrency(minOrder)} required`);
        return;
      }
      if ((c.rules?.minQty ?? 0) > cartQty) {
        setCodeError(`Min. ${c.rules?.minQty} items required`);
        return;
      }
      if (
        c.pricelistIds?.length &&
        selectedPricelist &&
        !c.pricelistIds.includes(selectedPricelist._id)
      ) {
        setCodeError('Restricted to a different pricelist');
        return;
      }
      addReward(codeToReward(c, 'coupon'));
      setCodeInput('');
      setCodeError('');
      return;
    }
    for (const d of posSettings?.discountCodes ?? []) {
      if (!d.active || d.code.toUpperCase() !== upper) continue;
      if (d.availableOn && d.availableOn.pos === false) {
        setCodeError('Not valid at POS');
        return;
      }
      if (d.validFrom && new Date(d.validFrom) > now) {
        setCodeError('Not yet valid');
        return;
      }
      if (d.validTo && new Date(d.validTo) < now) {
        setCodeError('Expired');
        return;
      }
      if ((d.maxUsage ?? 0) > 0 && (d.usageCount ?? 0) >= d.maxUsage!) {
        setCodeError('Usage limit reached');
        return;
      }
      const minOrder = d.rules?.minOrderValue ?? d.minOrderValue ?? 0;
      if (minOrder > total) {
        setCodeError(`Min. order ${formatCurrency(minOrder)} required`);
        return;
      }
      if ((d.rules?.minQty ?? 0) > cartQty) {
        setCodeError(`Min. ${d.rules?.minQty} items required`);
        return;
      }
      if (
        d.pricelistIds?.length &&
        selectedPricelist &&
        !d.pricelistIds.includes(selectedPricelist._id)
      ) {
        setCodeError('Restricted to a different pricelist');
        return;
      }
      addReward(codeToReward(d, 'discount_code'));
      setCodeInput('');
      setCodeError('');
      return;
    }
    setCodeError('Code not found or inactive');
  }

  // ── Available promotions ──────────────────────────────────────────────────
  const availablePromos = (posSettings?.promotions ?? []).filter((p) => {
    if (!p.active) return false;
    if (p.startDate && new Date(p.startDate) > now) return false;
    if (p.endDate && new Date(p.endDate) < now) return false;
    if (p.availableOn && p.availableOn.pos === false) return false;
    if ((p.rules?.minOrderValue ?? 0) > total) return false;
    if ((p.rules?.minQty ?? 0) > cartQty) return false;
    return true;
  });

  // ── Available BuyXGetY ────────────────────────────────────────────────────
  const availableBxgy = (posSettings?.buyXGetY ?? []).filter((b) => {
    if (!b.active) return false;
    if (b.validFrom && new Date(b.validFrom) > now) return false;
    if (b.validTo && new Date(b.validTo) < now) return false;
    if (b.availableOn && b.availableOn.pos === false) return false;
    if ((b.rules?.minOrderValue ?? b.minOrderValue ?? 0) > total) return false;
    const baseItems = items.filter((i) => !i.bxgyRef);
    const pool = b.applyTo
      ? baseItems.filter((i) => itemMatchesApplicableItems(i, b.applyTo))
      : (b.buyProducts?.length ?? 0) > 0
        ? baseItems.filter((i) => b.buyProducts!.includes(i.productId))
        : baseItems;
    const poolQty = pool.reduce((s, i) => s + i.quantity, 0);
    // Same-pool (no explicit getProducts): require at least one complete set (buyQty + getQty)
    const hasExplicitGetPool =
      !!b.rewardApplyTo || (b.getProducts?.length ?? 0) > 0;
    const minRequired = hasExplicitGetPool ? b.buyQty : b.buyQty + b.getQty;
    return poolQty >= minRequired;
  });

  // ── Loyalty ── pulled from DB customer balance (never static manual entry) ──
  const loyaltyEnabled = posSettings?.loyaltyEnabled ?? false;
  const loyaltyPtsPerN = posSettings?.loyaltyPointsPerNaira ?? 0.01;
  const loyaltyPtVal = posSettings?.loyaltyPointsValue ?? 1;
  const maxRedPct = posSettings?.loyaltyMaxRedemptionPct ?? 50;
  const minRedeem = posSettings?.loyaltyCard?.minRedemption ?? 0;
  // Points come from the cart's selected customer — set when cashier picks from DB
  const loyaltyPoints = customer.customerId ? (customer.loyaltyPoints ?? 0) : 0;
  const hasCustomer = !!customer.customerId;
  const earnedPts = Math.round((total / 100) * loyaltyPtsPerN * 100);
  const maxRedeem = Math.round((total * maxRedPct) / 100);
  const redeemValue = Math.min(
    Math.round(loyaltyPoints * loyaltyPtVal),
    maxRedeem
  );
  const canRedeem =
    loyaltyEnabled &&
    hasCustomer &&
    loyaltyPoints >= minRedeem &&
    redeemValue > 0;
  const loyaltyApplied = appliedIds.has('loyalty');

  function toggleLoyalty() {
    if (loyaltyApplied) {
      removeReward('loyalty');
    } else {
      if (!canRedeem) return;
      addReward({
        id: 'loyalty',
        kind: 'loyalty',
        name: 'Loyalty Redemption',
        color: '#d97706',
        discType: 'fixed',
        discValue: redeemValue,
        applyOn: 'order',
        maxDiscount: 0,
        detail: `₦${formatCurrency(redeemValue)} redeemed (${loyaltyPoints} pts)`,
      });
    }
  }

  // ── Discount programs ─────────────────────────────────────────────────────
  const activePrograms = (posSettings?.discountPrograms ?? []).filter(
    (d) => d.active
  );
  const noOptions =
    activePrograms.length === 0 &&
    availablePromos.length === 0 &&
    availableBxgy.length === 0 &&
    !loyaltyEnabled;

  // Compute live discount for each applied reward to show in the header summary
  // Base for reward computation = subtotal after the manual cart-level discount
  const postCartDiscBase = Math.max(0, subtotal - discountAmount);
  const rewardsTotal = appliedRewards.reduce(
    (s, r) => s + computeRewardDiscount(r, items, postCartDiscBase),
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <PiStar className="h-5 w-5 text-[#b20202]" />
            <div>
              <p className="text-sm font-bold text-gray-900">
                Rewards & Discounts
              </p>
              {appliedRewards.length > 0 && (
                <p className="text-[11px] font-semibold text-emerald-600">
                  {appliedRewards.length} applied · −
                  {formatCurrency(rewardsTotal)}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <PiX className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 divide-y divide-gray-50 overflow-y-auto">
          {/* ── Coupon / Discount Code ── */}
          <div className="space-y-2 px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Coupon or Discount Code
            </p>
            {/* Applied codes */}
            {appliedRewards
              .filter((r) => r.kind === 'coupon' || r.kind === 'discount_code')
              .map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"
                >
                  <PiCheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-bold tracking-widest text-emerald-800">
                      {r.code}
                    </p>
                    <p className="text-[11px] text-emerald-600">
                      {r.name} · −
                      {formatCurrency(computeRewardDiscount(r, items, total))}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeReward(r.id)}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-200 text-emerald-700 hover:bg-emerald-300"
                  >
                    <PiX className="h-3 w-3" />
                  </button>
                </div>
              ))}
            {/* Code input */}
            <div className="flex gap-2">
              <input
                value={codeInput}
                onChange={(e) => {
                  setCodeInput(e.target.value.toUpperCase());
                  setCodeError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && validateAndApplyCode()}
                placeholder="Enter coupon or discount code"
                className={`flex-1 rounded-xl border px-3.5 py-2.5 font-mono text-sm font-bold uppercase tracking-widest outline-none transition-colors ${codeError ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-[#b20202]'}`}
              />
              <button
                type="button"
                onClick={validateAndApplyCode}
                disabled={!codeInput.trim()}
                className="flex items-center gap-1.5 rounded-xl bg-[#b20202] px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-40"
              >
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
              <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Preset Discounts
              </p>
              <div className="space-y-2">
                {activePrograms.map((dp) => {
                  const rid = `dp_${dp._id ?? dp.name}`;
                  const applied = appliedIds.has(rid);
                  const reward: CartAppliedReward = {
                    id: rid,
                    kind: 'discount_program',
                    name: dp.name,
                    color: dp.color,
                    discType: dp.type === 'pct' ? 'pct' : 'fixed',
                    discValue: dp.value,
                    applyOn: 'order',
                    maxDiscount: 0,
                    detail:
                      dp.type === 'pct'
                        ? `${dp.value}%`
                        : `₦${formatCurrency(dp.value)}`,
                  };
                  const disc = computeRewardDiscount(reward, items, total);
                  return (
                    <button
                      key={rid}
                      type="button"
                      onClick={() => toggle(reward)}
                      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${applied ? 'border-[#b20202]/40 bg-red-50 ring-1 ring-[#b20202]/30' : 'border-gray-200 hover:bg-gray-50'}`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        {applied ? (
                          <PiCheckCircle className="h-4 w-4 shrink-0 text-[#b20202]" />
                        ) : (
                          <div className="h-4 w-4 shrink-0 rounded-full border-2 border-gray-300" />
                        )}
                        <div className="min-w-0">
                          <p
                            className={`truncate text-sm font-bold ${applied ? 'text-[#b20202]' : 'text-gray-800'}`}
                          >
                            {dp.name}
                          </p>
                          {dp.description && (
                            <p className="truncate text-[10px] text-gray-400">
                              {dp.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="ml-3 shrink-0 text-right">
                        <span
                          className={`rounded-lg px-2.5 py-1 text-xs font-black ${applied ? 'bg-[#b20202] text-white' : 'bg-gray-100 text-gray-700'}`}
                          style={
                            !applied && dp.color
                              ? {
                                  backgroundColor: `${dp.color}18`,
                                  color: dp.color,
                                }
                              : undefined
                          }
                        >
                          {dp.type === 'pct'
                            ? `${dp.value}%`
                            : `₦${formatCurrency(dp.value)}`}
                        </span>
                        {applied && (
                          <p className="mt-0.5 text-[10px] font-semibold text-[#b20202]">
                            −{formatCurrency(disc)}
                          </p>
                        )}
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
              <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Available Promotions
              </p>
              <div className="space-y-2">
                {availablePromos.map((p) => {
                  const color = p.color || '#d97706';
                  const applied = appliedIds.has(p._id!);
                  const reward: CartAppliedReward = {
                    id: p._id!,
                    kind: 'promotion',
                    name: p.name,
                    color,
                    discType: (p.reward?.discountType ?? p.type) as
                      | 'pct'
                      | 'fixed',
                    discValue: p.reward?.discountValue ?? p.value,
                    applyOn: (p.reward?.applyOn ??
                      'order') as CartAppliedReward['applyOn'],
                    maxDiscount: p.reward?.maxDiscount ?? 0,
                    detail: p.description,
                  };
                  const disc = computeRewardDiscount(reward, items, total);
                  return (
                    <button
                      key={p._id}
                      type="button"
                      onClick={() => toggle(reward)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${applied ? 'ring-1' : 'border-gray-200 hover:opacity-90'}`}
                      style={
                        applied
                          ? {
                              borderColor: `${color}60`,
                              backgroundColor: `${color}12`,
                              outlineColor: color,
                            }
                          : {
                              borderColor: `${color}30`,
                              backgroundColor: `${color}08`,
                            }
                      }
                    >
                      {applied ? (
                        <PiCheckCircle
                          className="h-4 w-4 shrink-0"
                          style={{ color }}
                        />
                      ) : (
                        <PiLightning
                          className="h-4 w-4 shrink-0"
                          style={{ color }}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-800">
                          {p.name}
                        </p>
                        {p.description && (
                          <p className="text-[10px] text-gray-400">
                            {p.description}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <span
                          className="rounded-lg px-2.5 py-1 text-xs font-black text-white"
                          style={{ backgroundColor: color }}
                        >
                          {reward.discType === 'pct'
                            ? `${reward.discValue}% off`
                            : `₦${formatCurrency(reward.discValue ?? 0)} off`}
                        </span>
                        {applied && (
                          <p
                            className="mt-0.5 text-[10px] font-semibold"
                            style={{ color }}
                          >
                            −{formatCurrency(disc)}
                          </p>
                        )}
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
              <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Buy X Get Y
              </p>
              <div className="space-y-2">
                {availableBxgy.map((b) => {
                  const color = b.color || '#7c3aed';
                  const applied = appliedIds.has(b._id!);
                  const reward: CartAppliedReward = {
                    id: b._id!,
                    kind: 'bxgy',
                    name: b.name,
                    color,
                    buyQty: b.buyQty,
                    getQty: b.getQty,
                    getDiscountPct: b.getDiscountPct,
                    buyProducts: b.buyProducts,
                    getProducts: b.getProducts,
                    applyTo: b.applyTo,
                    rewardApplyTo: b.rewardApplyTo,
                  };
                  const disc = computeRewardDiscount(reward, items, total);
                  const getProdNames = (b.getProducts ?? [])
                    .map(
                      (id) =>
                        posProducts.find(
                          (p) => String(p.product?._id) === String(id)
                        )?.product?.name
                    )
                    .filter(Boolean);
                  const rewardDesc =
                    getProdNames.length > 0
                      ? `Buy ${b.buyQty} get ${b.getQty} ${getProdNames[0]} ${b.getDiscountPct === 100 ? 'free' : `at ${b.getDiscountPct}% off`}`
                      : `Buy ${b.buyQty} get ${b.getQty} ${b.getDiscountPct === 100 ? 'free' : `at ${b.getDiscountPct}% off`}`;
                  return (
                    <button
                      key={b._id}
                      type="button"
                      onClick={() => toggle(reward)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${applied ? 'ring-1' : 'border-gray-200 hover:opacity-90'}`}
                      style={
                        applied
                          ? {
                              borderColor: `${color}60`,
                              backgroundColor: `${color}12`,
                            }
                          : {
                              borderColor: `${color}30`,
                              backgroundColor: `${color}08`,
                            }
                      }
                    >
                      {applied ? (
                        <PiCheckCircle
                          className="h-4 w-4 shrink-0"
                          style={{ color }}
                        />
                      ) : (
                        <PiShoppingCart
                          className="h-4 w-4 shrink-0"
                          style={{ color }}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-800">
                          {b.name}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {rewardDesc}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span
                          className="rounded-lg px-2.5 py-1 text-xs font-black text-white"
                          style={{ backgroundColor: color }}
                        >
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
              <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Loyalty Points
              </p>
              {!hasCustomer ? (
                <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3">
                  <PiCoins className="h-4 w-4 shrink-0 text-amber-400" />
                  <p className="text-sm font-medium text-amber-700">
                    Assign a customer to use loyalty points.
                    <span className="ml-1 font-normal text-amber-600">
                      Close this panel and tap <strong>Customer</strong>.
                    </span>
                  </p>
                </div>
              ) : (
                <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <PiCoins className="h-4 w-4 shrink-0 text-amber-500" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-700">
                          {customer.firstName} {customer.lastName}
                        </p>
                        {customer.phone && (
                          <p className="text-[10px] text-gray-400">
                            {customer.phone}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-black tabular-nums text-amber-700">
                        {loyaltyPoints.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-amber-500">points</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-amber-100 bg-white px-3 py-2">
                      <p className="text-gray-400">Earns this order</p>
                      <p className="font-bold text-amber-700">
                        +{earnedPts} pts
                      </p>
                    </div>
                    <div className="rounded-lg border border-amber-100 bg-white px-3 py-2">
                      <p className="text-gray-400">
                        Can redeem (max {maxRedPct}%)
                      </p>
                      <p
                        className={`font-bold ${canRedeem ? 'text-emerald-600' : 'text-gray-400'}`}
                      >
                        {loyaltyPoints >= minRedeem
                          ? `₦${formatCurrency(redeemValue)}`
                          : `Need ${minRedeem} pts min`}
                      </p>
                    </div>
                  </div>
                  {canRedeem && (
                    <button
                      type="button"
                      onClick={toggleLoyalty}
                      className={`w-full rounded-xl py-2.5 text-sm font-bold transition-colors ${loyaltyApplied ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'text-white hover:opacity-90'}`}
                      style={
                        loyaltyApplied
                          ? undefined
                          : { backgroundColor: '#d97706' }
                      }
                    >
                      {loyaltyApplied
                        ? `✓ ₦${formatCurrency(redeemValue)} applied — click to remove`
                        : `Apply ₦${formatCurrency(redeemValue)} loyalty discount`}
                    </button>
                  )}
                  {!canRedeem &&
                    loyaltyPoints > 0 &&
                    loyaltyPoints < minRedeem && (
                      <p className="text-center text-[11px] text-amber-600">
                        Need {minRedeem} pts to redeem ·{' '}
                        {minRedeem - loyaltyPoints} more to go
                      </p>
                    )}
                </div>
              )}
            </div>
          )}

          {noOptions && (
            <div className="px-5 py-10 text-center">
              <PiStar className="mx-auto mb-2 h-10 w-10 text-gray-200" />
              <p className="text-sm font-medium text-gray-500">
                No rewards available
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Configure discount programs and promotions in POS settings
              </p>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl py-2.5 text-sm font-bold text-white hover:opacity-90"
            style={{ backgroundColor: '#b20202' }}
          >
            Done
            {appliedRewards.length > 0
              ? ` · ${appliedRewards.length} reward${appliedRewards.length > 1 ? 's' : ''} applied`
              : ''}
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
  onQuotationOrder,
  onClose,
}: {
  onDiscount: () => void;
  onNote: () => void;
  onPricelist: () => void;
  onCancelOrder: () => void;
  onReward: () => void;
  onQuotationOrder: () => void;
  onClose: () => void;
}) {
  const { selectedPricelist } = usePOSPricelist();
  const { appliedRewards: _ar } = usePOSCart();

  type Action = {
    label: string;
    icon: React.ReactNode;
    fn: (() => void) | null;
    active?: boolean;
    danger?: boolean;
  };
  const actions: Action[] = [
    {
      label: 'General Note',
      icon: <PiNote className="h-5 w-5" />,
      fn: () => {
        onNote();
        onClose();
      },
    },
    {
      label: 'Quotation/Order',
      icon: <PiLinkSimple className="h-5 w-5" />,
      fn: () => {
        onQuotationOrder();
        onClose();
      },
    },
    {
      label: 'Reward',
      icon: <PiStar className="h-5 w-5" />,
      fn: () => {
        onReward();
        onClose();
      },
      active: _ar.length > 0,
    },
    {
      label: 'Discount',
      icon: <PiPercent className="h-5 w-5" />,
      fn: () => {
        onDiscount();
        onClose();
      },
    },
    {
      label: 'Customer Note',
      icon: <PiNote className="h-5 w-5" />,
      fn: () => {
        onNote();
        onClose();
      },
    },
    {
      label: selectedPricelist ? selectedPricelist.name : 'Price List',
      icon: <PiList className="h-5 w-5" />,
      fn: () => {
        onPricelist();
        onClose();
      },
      active: !!selectedPricelist,
    },
    {
      label: 'Refund',
      icon: <PiArrowCounterClockwise className="h-5 w-5" />,
      fn: null,
    },
    {
      label: 'Cancel Order',
      icon: <PiTrash className="h-5 w-5" />,
      fn: () => {
        onCancelOrder();
        onClose();
      },
      danger: true,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Actions</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
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
                  ? 'cursor-not-allowed bg-gray-50 text-gray-400'
                  : a.danger
                    ? 'bg-red-50 text-red-600 hover:bg-red-100'
                    : a.active
                      ? 'bg-[#b20202]/10 text-[#b20202] ring-1 ring-[#b20202]/30 hover:bg-[#b20202]/15'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {a.icon}
              <span className="max-w-[80px] truncate text-center leading-tight">
                {a.label}
              </span>
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
  token,
  onSelectCustomer,
  onClose,
}: {
  current: import('@/app/shared/point-of-sale/store').CartCustomer;
  token: string | null;
  onSelectCustomer: (c: POSCustomer | null) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<POSCustomer[]>([]);
  const [searching, setSearching] = useState(false);

  // Create new customer form
  const [showCreate, setShowCreate] = useState(false);
  const [cFirst, setCFirst] = useState('');
  const [cLast, setCLast] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [creating, setCreating] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Debounced search
  useEffect(() => {
    if (!token) return;
    if (!search.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await posApi.searchCustomers(token, search.trim(), 15);
        setResults(data.customers);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search, token]);

  // Load recent customers on open
  useEffect(() => {
    if (!token || search.trim()) return;
    posApi
      .searchCustomers(token, '', 10)
      .then((d) => setResults(d.customers))
      .catch(() => {});
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate() {
    if (!token || !cFirst.trim()) return;
    setCreating(true);
    try {
      const data = await posApi.createCustomer(token, {
        firstName: cFirst.trim(),
        lastName: cLast.trim(),
        phone: cPhone.trim(),
        email: cEmail.trim(),
      });
      onSelectCustomer(data.customer);
    } catch (err: unknown) {
      // If duplicate phone, the API returns 409 with the existing customer
      const body = (err as { customer?: POSCustomer })?.customer;
      if (body) {
        onSelectCustomer(body);
        return;
      }
      toast.error(
        err instanceof Error ? err.message : 'Failed to create customer'
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200"
          >
            Close
          </button>
          <div className="relative flex-1">
            <PiMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or phone…"
              className="h-9 w-full rounded-lg border border-gray-200 pl-9 pr-3 text-sm outline-none focus:border-[#b20202]"
            />
          </div>
          {searching && (
            <PiSpinner className="h-4 w-4 shrink-0 animate-spin text-gray-400" />
          )}
        </div>

        {/* Results list */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Walk-in */}
          <button
            type="button"
            onClick={() => onSelectCustomer(null)}
            className={`flex w-full items-center justify-between border-b border-gray-50 px-5 py-3 text-left text-sm hover:bg-gray-50 ${
              !current.customerId ? 'bg-amber-50' : ''
            }`}
          >
            <div>
              <p className="font-semibold text-gray-700">Walk-in Customer</p>
              <p className="text-[10px] text-gray-400">No loyalty tracking</p>
            </div>
            {!current.customerId && (
              <PiCheckCircle className="h-4 w-4 text-amber-500" />
            )}
          </button>

          {results.map((c) => {
            const isSelected = current.customerId === String(c._id);
            return (
              <button
                key={c._id}
                type="button"
                onClick={() => onSelectCustomer(c)}
                className={`flex w-full items-center justify-between border-b border-gray-50 px-5 py-3 text-left transition-colors hover:bg-gray-50 ${
                  isSelected ? 'bg-red-50' : ''
                }`}
              >
                <div className="min-w-0">
                  <p
                    className={`text-sm font-semibold leading-tight ${isSelected ? 'text-[#b20202]' : 'text-gray-800'}`}
                  >
                    {c.firstName} {c.lastName}
                  </p>
                  <p className="truncate text-[11px] text-gray-400">
                    {c.phone || c.email || 'No contact'}
                  </p>
                </div>
                <div className="ml-3 shrink-0 text-right">
                  <p className="text-xs font-bold text-amber-600">
                    {c.loyaltyPoints.toLocaleString()} pts
                  </p>
                  {c.totalOrders ? (
                    <p className="text-[10px] text-gray-400">
                      {c.totalOrders} orders
                    </p>
                  ) : null}
                </div>
              </button>
            );
          })}

          {!search.trim() && results.length === 0 && !searching && (
            <p className="px-5 py-4 text-center text-xs text-gray-400">
              No customers yet — create one below
            </p>
          )}
          {search.trim() && results.length === 0 && !searching && (
            <p className="px-5 py-4 text-center text-xs text-gray-400">
              No customers found for &ldquo;{search}&rdquo;
            </p>
          )}
        </div>

        {/* Create new customer */}
        <div className="shrink-0 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="flex w-full items-center gap-2 px-5 py-3 text-xs font-bold text-[#b20202] transition-colors hover:bg-red-50"
          >
            <PiPlus className="h-3.5 w-3.5" />
            {showCreate ? 'Hide form' : 'Create new customer'}
          </button>
          {showCreate && (
            <div className="space-y-2 border-t border-gray-100 px-5 pb-4 pt-3">
              <div className="flex gap-2">
                <input
                  value={cFirst}
                  onChange={(e) => setCFirst(e.target.value)}
                  placeholder="First name *"
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#b20202]"
                />
                <input
                  value={cLast}
                  onChange={(e) => setCLast(e.target.value)}
                  placeholder="Last name"
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#b20202]"
                />
              </div>
              <div className="flex gap-2">
                <input
                  value={cPhone}
                  onChange={(e) => setCPhone(e.target.value)}
                  placeholder="Phone"
                  type="tel"
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#b20202]"
                />
                <input
                  value={cEmail}
                  onChange={(e) => setCEmail(e.target.value)}
                  placeholder="Email"
                  type="email"
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#b20202]"
                />
              </div>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!cFirst.trim() || creating}
                className="w-full rounded-lg py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: '#b20202' }}
              >
                {creating ? 'Creating…' : 'Create & Select'}
              </button>
            </div>
          )}
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
    addItem,
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
    addReward,
    removeReward,
    rewardsDiscountTotal,
  } = usePOSCart();

  const { setActiveView } = usePOSUI();
  const { staff, token } = usePOSAuth();
  const settings = usePOSSettings();
  const { selectedPricelist, setSelectedPricelist } = usePOSPricelist();
  const { combos, setCombos } = usePOSCombos();
  const staffPerms: string[] = staff?.posPermissions ?? [];
  const canDiscount = staffPerms.includes('pos:discount');
  const canRefund = staffPerms.includes('pos:refund');

  // Edit combo state
  type EditComboState = {
    combo: POSCombo;
    instanceId: string;
    groupItems: POSCartItem[];
    initialPicks: Record<
      number,
      Record<number, { val: string | true; qty: number }>
    >;
  };
  const [editingCombo, setEditingCombo] = useState<EditComboState | null>(null);
  const [loadingEdit, setLoadingEdit] = useState<string | null>(null); // instanceId being loaded

  // UI state
  const [showActions, setShowActions] = useState(false);
  const [showCustomer, setShowCustomer] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [showPricelist, setShowPricelist] = useState(false);
  const [showRewards, setShowRewards] = useState(false);
  const [showHeldOrders, setShowHeldOrders] = useState(false);
  const [showOrderPicker, setShowOrderPicker] = useState(false);

  // Warehouse
  const { warehouseId, setWarehouseId, warehouses } = usePOSWarehouse();
  const { load: loadWarehouses } = usePOSAvailableWarehouses();
  const { setLinkedSalesOrderId } = usePOSLinkedSalesOrder();

  // Load warehouses once when token is available
  useEffect(() => {
    if (token) loadWarehouses(token);
  }, [token, loadWarehouses]);

  // Load a sales order into the cart
  function handleLoadOrder(so: any) {
    if (
      items.length > 0 &&
      !window.confirm(
        'Loading this order will clear the current cart. Continue?'
      )
    )
      return;
    clearCart();
    if (so.customerSnapshot?.name) {
      setCustomer({
        firstName: so.customerSnapshot.name.split(' ')[0] ?? '',
        lastName: so.customerSnapshot.name.split(' ').slice(1).join(' '),
        email: so.customerSnapshot.email ?? '',
        phone: so.customerSnapshot.phone ?? '',
        customerId: so.customer ?? undefined,
      });
    }
    for (const line of (so.items ?? []).filter(
      (l: any) => l.lineType !== 'section' && l.lineType !== 'note'
    )) {
      if (!line.subproduct) continue;
      addItem({
        subProductId: line.subproduct,
        productId: line.product ?? '',
        name: line.name,
        sku: line.sku ?? '',
        sizeId: line.sizeId ?? undefined,
        sizeName: line.sizeName ?? undefined,
        price: line.unitPrice ?? 0,
        costPrice: line.costPrice ?? 0,
        taxRate: line.taxRate ?? 0,
        quantity: line.quantity ?? 1,
        bundleDeals: [],
        imageUrl: undefined,
      });
    }
    if (so.warehouseId) setWarehouseId(so.warehouseId);
    setLinkedSalesOrderId(so._id);
    setShowOrderPicker(false);
    toast.success(`Loaded ${so.soNumber} into cart`);
  }

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

  // BXGY get items are non-interactive; never treat them as the active dialpad item
  const selectedItem =
    items.find((i) => itemKey(i) === selectedKey && !i.bxgyRef) ?? null;

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
    const ci = item.comboRef?.instanceId;
    if (mode === 'qty')
      updateQuantity(
        item.subProductId,
        Math.max(1, Math.round(num)),
        item.sizeId,
        ci
      );
    if (mode === 'disc')
      updateItemDiscount(item.subProductId, num, item.sizeId, ci);
    if (mode === 'price')
      updateItemPrice(item.subProductId, num, item.sizeId, ci);
  }

  const pushDigit = useCallback(
    (d: string) => {
      if (!selectedItem) return;
      let next: string;
      if (d === '.') {
        next = dialInput.includes('.') ? dialInput : (dialInput || '') + '.';
      } else {
        // Empty or "0" means start fresh (first digit replaces).
        // Otherwise append so multi-digit values like "15" work.
        next =
          !dialInput || dialInput === '0'
            ? d
            : dialInput.length >= 8
              ? dialInput
              : dialInput + d;
      }
      setDialInput(next);
      applyDial(next, dialMode, selectedItem);
    },
    [dialInput, dialMode, selectedItem]
  );

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
    // BXGY get items can't be selected — skip them for dialpad selection
    const selectableItems = items.filter((i) => !i.bxgyRef);
    const stillValid = selectableItems.some((i) => itemKey(i) === selectedKey);
    if (!stillValid) {
      const last = selectableItems[selectableItems.length - 1];
      if (last) {
        setSelectedKey(itemKey(last));
        setDialInput(String(last.quantity));
      } else {
        setSelectedKey(null);
        setDialInput('');
      }
    }
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-recalculate BXGY free items when base cart items change ─────────
  // Tracks the non-BXGY items only so that injecting get items doesn't re-trigger.
  const prevBxgyBaseKeyRef = useRef('');
  useEffect(() => {
    const bxgyRewards = appliedRewards.filter((r) => r.kind === 'bxgy');
    if (bxgyRewards.length === 0) return;

    const baseKey = items
      .filter((i) => !i.bxgyRef)
      .map((i) => `${i.subProductId}_${i.sizeId ?? ''}_${i.quantity}`)
      .sort()
      .join('|');

    if (baseKey === prevBxgyBaseKeyRef.current) return;
    prevBxgyBaseKeyRef.current = baseKey;

    for (const r of bxgyRewards) {
      addReward(r); // re-injects get items (or removes reward if no longer qualifying)
    }
    // addReward is stable when base items haven't changed, so this is safe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, appliedRewards]);

  function handleNewOrder() {
    addCart();
  }

  function handleSetCustomer(c: POSCustomer | null) {
    if (!c) {
      setCustomer({
        firstName: 'Walk-in',
        lastName: 'Customer',
        email: 'walkin@pos.local',
        phone: '',
      });
    } else {
      setCustomer({
        customerId: String(c._id),
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email || 'walkin@pos.local',
        phone: c.phone || '',
        loyaltyPoints: c.loyaltyPoints,
        walletBalance: c.walletBalance,
        // Customer-assigned pricelist drives the POS auto-pick (server re-validates).
        pricelistId: c.pricelist || undefined,
        pricelistName: c.pricelistName || undefined,
      });
    }
    setShowCustomer(false);
  }

  async function handleEditCombo(
    instanceId: string,
    comboId: string,
    groupItems: POSCartItem[]
  ) {
    // Find the full combo definition — use cached atom first, fetch if missing
    let combo = combos.find((c) => String(c._id) === String(comboId));
    if (!combo && token) {
      setLoadingEdit(instanceId);
      try {
        const data = await posApi.getCombos(token);
        setCombos(data.combos || []);
        combo = (data.combos || []).find(
          (c) => String(c._id) === String(comboId)
        );
      } catch {
        toast.error('Could not load combo details');
        return;
      } finally {
        setLoadingEdit(null);
      }
    }
    if (!combo) {
      toast.error('Combo not found — it may have been deleted');
      return;
    }

    // Rebuild picks from current cart items
    const initialPicks: Record<
      number,
      Record<number, { val: string | true; qty: number }>
    > = {};
    combo.choiceLines.forEach((line, li) => {
      line.items.forEach((item, ii) => {
        const spId = String(item.subProduct?._id ?? '');
        const cartItem = groupItems.find(
          (ci) =>
            String(ci.subProductId) === spId &&
            (ci.sizeId
              ? !item.allowedSizes?.length ||
                item.allowedSizes.map(String).includes(ci.sizeId)
              : true)
        );
        if (cartItem) {
          if (!initialPicks[li]) initialPicks[li] = {};
          initialPicks[li][ii] = {
            val: cartItem.sizeId ?? true,
            qty: cartItem.quantity,
          };
        }
      });
    });

    setEditingCombo({ combo, instanceId, groupItems, initialPicks });
  }

  function handleCheckout() {
    if (!items.length) return toast.error('Cart is empty');
    setActiveView('payment');
  }

  const hasCustomer = !!customer.customerId;
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
  const modeLabels: Record<DialMode, string> = {
    qty: 'Qty',
    disc: '%',
    price: 'Price',
  };

  const disabled = !selectedItem;

  // ── Cart item row renderer (shared for regular + combo items) ─────────────
  function renderCartItem(item: POSCartItem, isComboChild: boolean) {
    const key = itemKey(item);
    const isSelected = selectedKey === key;
    const ci = item.comboRef?.instanceId;
    const isBxgy = !!item.bxgyRef;

    const bestBundle = selectedPricelist
      ? getBestBundleForItem(item, selectedPricelist)
      : getBestBundle(item);
    const { price: effectivePrice, overrides: bundleOverrides } =
      selectedPricelist
        ? getEffectiveBundlePriceForItem(item, selectedPricelist)
        : getEffectiveBundlePrice(item);
    const lineGross = effectivePrice * item.quantity;
    const itemDiscAmt =
      (lineGross * Math.max(0, Math.min(100, item.discount))) / 100;
    let bundleDiscAmt = 0;
    if (bestBundle && !bundleOverrides) {
      const dt = bestBundle.discountType ?? 'percentage';
      bundleDiscAmt =
        dt === 'fixed'
          ? Math.max(
              0,
              Math.min(
                (bestBundle.discount ?? 0) * item.quantity,
                lineGross - itemDiscAmt
              )
            )
          : Math.max(
              0,
              (lineGross * Math.min(100, bestBundle.discount ?? 0)) / 100
            );
    }
    const lineTotal = Math.max(0, lineGross - itemDiscAmt - bundleDiscAmt);
    const bundleActive = bestBundle && (bundleDiscAmt > 0 || bundleOverrides);

    const bundleLabel = bundleActive
      ? (() => {
          const dt = bestBundle!.discountType ?? 'percentage';
          const name = bestBundle!.name ? ` (${bestBundle!.name})` : '';
          if (dt === 'markup_on_cost')
            return `📦 Bundle${name}: Cost +${bestBundle!.discount ?? 0}% → ${formatCurrency(effectivePrice)}/unit`;
          if (dt === 'no_discount')
            return `📦 Bundle${name}: No discount → ${formatCurrency(effectivePrice)}/unit`;
          if (dt === 'fixed')
            return `📦 Bundle${name}: -${formatCurrency((bestBundle!.discount ?? 0) * item.quantity)}`;
          return `📦 Bundle${name}: -${bestBundle!.discount ?? 0}%`;
        })()
      : null;

    const qtyDisplay =
      isSelected && dialMode === 'qty' && dialInput !== ''
        ? dialInput
        : String(item.quantity);

    // ── BXGY get-item line ─────────────────────────────────────────────────────
    // Renders as a plain unstyled inline line matching the reference UI:
    // "Free Product - [Name]"  ·  qty × -price  (italic, dark colors, no border/background)
    if (isBxgy) {
      const bxgy = item.bxgyRef!;
      const origPrice = bxgy.originalPrice;
      const discPct = bxgy.discPct;
      const unitSaving = origPrice * (discPct / 100);
      const lineSaving = unitSaving * item.quantity;
      const label = discPct === 100 ? 'Free Product' : `${discPct}% off`;
      const qtyStr = Number.isInteger(item.quantity)
        ? String(item.quantity)
        : item.quantity.toFixed(2);

      return (
        <div
          key={key}
          className={`w-full border-b border-gray-100 ${isComboChild ? 'py-2.5 pl-6 pr-4' : 'px-4 py-3'}`}
        >
          {/* Row 1: "Free Product - Name"  +  negative line total  +  remove */}
          <div className="flex items-start justify-between gap-2">
            <span className="flex-1 text-sm font-semibold italic leading-tight text-gray-800">
              {label} - {item.name}
              {item.variant ? ` - ${item.variant}` : ''}
            </span>
            <span className="shrink-0 text-sm font-bold tabular-nums text-gray-800">
              -{formatCurrency(lineSaving)}
            </span>
            <span
              role="button"
              tabIndex={0}
              title={`Remove ${bxgy.rewardName ?? 'BXGY'} deal`}
              onClick={() => removeReward(bxgy.rewardId)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ')
                  removeReward(bxgy.rewardId);
              }}
              className="shrink-0 cursor-pointer text-gray-300 transition-colors hover:text-red-500"
            >
              <PiX className="h-3.5 w-3.5" />
            </span>
          </div>
          {/* Row 2: qty × -unit price / Units */}
          <div className="mt-1 flex items-center gap-1.5 text-xs italic text-gray-500">
            <span className="inline-block rounded border border-gray-300 bg-white px-1.5 py-0.5 font-semibold not-italic tabular-nums text-gray-700">
              {qtyStr}
            </span>
            <span>×</span>
            <span className="font-semibold tabular-nums">
              -{formatCurrency(unitSaving)}
            </span>
            <span>/ Units</span>
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
        className={`w-full border-b border-gray-100 text-left transition-colors ${isComboChild ? 'py-2.5 pl-6 pr-4' : 'px-4 py-3'} ${isSelected ? 'border-l-4 border-l-[#b20202] bg-red-50' : 'border-l-4 border-l-transparent hover:bg-gray-50'} `}
      >
        {/* Row 1: name + total */}
        <div className="flex items-start justify-between gap-2">
          <span className="flex-1 text-sm font-semibold leading-tight text-gray-900">
            {item.name}
            {item.variant ? ` - ${item.variant}` : ''}
          </span>
          <span
            className={`shrink-0 text-sm font-bold ${
              bundleDiscAmt > 0
                ? 'text-purple-700'
                : effectivePrice < item.price
                  ? 'text-emerald-700'
                  : 'text-gray-900'
            }`}
          >
            {formatCurrency(lineTotal)}
          </span>
        </div>
        {/* Row 2: qty × price + remove */}
        <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
          <span
            className={`inline-block rounded border px-1.5 py-0.5 font-semibold tabular-nums ${
              isSelected && dialMode === 'qty'
                ? 'border-[#b20202] bg-white text-[#b20202]'
                : 'border-gray-300 bg-white text-gray-700'
            }`}
          >
            {qtyDisplay}
          </span>
          <span>×</span>
          <span
            className={
              bundleOverrides
                ? 'font-semibold text-purple-700'
                : effectivePrice < item.price
                  ? 'font-semibold text-emerald-700'
                  : ''
            }
          >
            {formatCurrency(effectivePrice)}
            {Math.abs(effectivePrice - item.price) > 0.001 && (
              <span className="ml-1 text-[10px] font-normal text-gray-400 line-through">
                {formatCurrency(item.price)}
              </span>
            )}
          </span>
          <span>/ Units</span>
          {item.discount > 0 && settings.lineDiscounts && (
            <span className="ml-1 rounded bg-red-50 px-1.5 text-[#b20202]">
              -{Math.min(item.discount, settings.maxDiscountPct)}%
            </span>
          )}
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              removeItem(item.subProductId, item.sizeId, ci);
              if (selectedKey === key) {
                setSelectedKey(null);
                setDialInput('');
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                removeItem(item.subProductId, item.sizeId, ci);
                if (selectedKey === key) {
                  setSelectedKey(null);
                  setDialInput('');
                }
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
            <span className="tabular-nums">
              -{formatCurrency(bundleDiscAmt)}
            </span>
          </div>
        )}
      </button>
    );
  }

  // ── Hold / Recall handlers ────────────────────────────────────────────────
  async function handleHold() {
    if (!token || items.length === 0) return;
    try {
      await posApi.holdOrder(token, {
        items,
        customer,
        note: note || '',
        discountType,
        discountValue,
        appliedRewards: appliedRewards.map((r) => ({
          id: r.id,
          kind: r.kind,
          name: r.name,
          color: r.color,
          detail: r.detail,
          discType: r.discType,
          discValue: r.discValue,
          applyOn: r.applyOn,
          maxDiscount: r.maxDiscount,
          code: r.code,
          buyQty: r.buyQty,
          getQty: r.getQty,
          getDiscountPct: r.getDiscountPct,
        })),
        pricelistId: selectedPricelist?._id ?? undefined,
      });
      clearCart();
      toast.success('Order held', { icon: '⏸' });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to hold order');
    }
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
            className="flex h-10 w-10 shrink-0 items-center justify-center border-r border-gray-200 text-gray-500 transition-colors hover:bg-gray-100 hover:text-[#b20202]"
            title="New order"
          >
            <PiPlus className="h-4 w-4" />
          </button>

          {/* Tabs */}
          <div className="scrollbar-none flex flex-1 overflow-x-auto">
            {carts.map((cart) => {
              const isActive = cart.id === activeCartId;
              const cartItemCount = cart.items.reduce(
                (s, i) => s + i.quantity,
                0
              );
              return (
                <div
                  key={cart.id}
                  className={`group flex shrink-0 items-center gap-1.5 border-r border-gray-200 px-3 py-2 transition-colors ${
                    isActive
                      ? 'border-b-2 border-b-[#b20202] bg-white text-[#b20202]'
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
                      <span
                        className={`flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                          isActive
                            ? 'bg-[#b20202] text-white'
                            : 'bg-gray-300 text-gray-700'
                        }`}
                      >
                        {cartItemCount}
                      </span>
                    )}
                  </button>
                  {carts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCart(cart.id)}
                      className="text-gray-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
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
              {(customer.loyaltyPoints ?? 0) > 0 && (
                <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-bold text-amber-700">
                  {(customer.loyaltyPoints ?? 0).toLocaleString()}pts
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Item list ── */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center">
              <EmptyProductBoxIcon className="h-16 w-16 text-gray-200" />
              <Text className="mt-2 text-sm text-gray-400">
                Add products to get started
              </Text>
            </div>
          ) : (
            <div>
              {(() => {
                // Optionally sort by categoryId
                const displayItems = settings.sortCartByCategory
                  ? [...items].sort((a, b) =>
                      (a.categoryId ?? '').localeCompare(b.categoryId ?? '')
                    )
                  : items;

                // Build display groups: regular items and BXGY get-items are standalone;
                // combo items are collected under a shared group header keyed by instanceId.
                type DisplayEntry =
                  | { kind: 'item'; item: POSCartItem }
                  | {
                      kind: 'combo';
                      instanceId: string;
                      comboName: string;
                      groupItems: POSCartItem[];
                    };

                const seen = new Set<string>();
                const entries: DisplayEntry[] = [];

                for (const item of displayItems) {
                  if (item.comboRef?.instanceId) {
                    const { instanceId, comboName } = item.comboRef;
                    if (!seen.has(instanceId)) {
                      seen.add(instanceId);
                      entries.push({
                        kind: 'combo',
                        instanceId,
                        comboName,
                        groupItems: items.filter(
                          (i) => i.comboRef?.instanceId === instanceId
                        ),
                      });
                    }
                  } else {
                    // Regular items AND BXGY get-items are both rendered inline —
                    // renderCartItem handles the different visual style for bxgyRef items.
                    entries.push({ kind: 'item', item });
                  }
                }

                return entries.map((entry) => {
                  if (entry.kind === 'combo') {
                    const { instanceId, comboName, groupItems } = entry;
                    const comboTotal = groupItems.reduce((s, i) => {
                      const { price: effPrice } = selectedPricelist
                        ? getEffectiveBundlePriceForItem(i, selectedPricelist)
                        : getEffectiveBundlePrice(i);
                      return s + effPrice * i.quantity;
                    }, 0);
                    const anySelected = groupItems.some(
                      (i) => selectedKey === itemKey(i)
                    );

                    // combo qty = first item's quantity (all items in group are same qty)
                    const comboQty = groupItems[0]?.quantity ?? 1;
                    const comboId = groupItems[0]?.comboRef?.comboId ?? '';
                    const isLoadingThis = loadingEdit === instanceId;

                    return (
                      <div
                        key={instanceId}
                        className={`border-b border-gray-100 ${anySelected ? 'bg-red-50/30' : ''}`}
                      >
                        {/* Combo group header */}
                        <div className="bg-[#b20202]/6 flex items-center gap-2 border-b border-[#b20202]/15 px-3 py-2">
                          {/* Name + item count */}
                          <div className="flex min-w-0 flex-1 items-center gap-1.5">
                            <span className="text-[10px]">🎁</span>
                            <span className="truncate text-xs font-bold text-[#b20202]">
                              {comboName}
                            </span>
                          </div>

                          {/* Qty control */}
                          <div className="flex shrink-0 items-center overflow-hidden rounded-lg border border-[#b20202]/20 bg-white">
                            <button
                              type="button"
                              onClick={() => {
                                if (comboQty <= 1) {
                                  removeComboGroup(instanceId);
                                  if (anySelected) {
                                    setSelectedKey(null);
                                    setDialInput('');
                                  }
                                } else {
                                  setComboGroupQty(instanceId, comboQty - 1);
                                }
                              }}
                              className="flex h-6 w-6 items-center justify-center text-[#b20202] transition-colors hover:bg-[#b20202]/10"
                            >
                              <PiMinus className="h-3 w-3" />
                            </button>
                            <span className="min-w-[20px] text-center text-xs font-bold text-gray-800">
                              {comboQty}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setComboGroupQty(instanceId, comboQty + 1)
                              }
                              className="flex h-6 w-6 items-center justify-center text-[#b20202] transition-colors hover:bg-[#b20202]/10"
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
                            onClick={() =>
                              handleEditCombo(instanceId, comboId, groupItems)
                            }
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#b20202]/60 transition-colors hover:bg-[#b20202]/10 hover:text-[#b20202] disabled:opacity-40"
                          >
                            {isLoadingThis ? (
                              <PiSpinner className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <PiPencilSimple className="h-3.5 w-3.5" />
                            )}
                          </button>

                          {/* Remove button */}
                          <button
                            type="button"
                            title="Remove combo"
                            onClick={() => {
                              removeComboGroup(instanceId);
                              if (anySelected) {
                                setSelectedKey(null);
                                setDialInput('');
                              }
                            }}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
                          >
                            <PiX className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Individual combo items */}
                        {groupItems.map((item) => renderCartItem(item, true))}
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
        {showNote && settings.allowOrderNotes && (
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

        {showDiscount && settings.globalDiscounts && (
          <div className="shrink-0 border-t border-gray-100 bg-gray-50 px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Order Discount
            </p>
            <div className="flex gap-2">
              <select
                value={discountType}
                onChange={(e) =>
                  setDiscount(
                    e.target.value as 'percent' | 'fixed',
                    discountValue
                  )
                }
                className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-[#b20202]"
              >
                <option value="percent">%</option>
                <option value="fixed">Fixed ₦</option>
              </select>
              <input
                type="number"
                value={discountValue || ''}
                onChange={(e) => {
                  const raw = Number(e.target.value);
                  const capped =
                    discountType === 'percent'
                      ? Math.min(raw, settings.maxDiscountPct)
                      : raw;
                  setDiscount(discountType, capped);
                }}
                placeholder="0"
                autoFocus
                className="w-24 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-[#b20202]"
                min={0}
                max={
                  discountType === 'percent'
                    ? settings.maxDiscountPct
                    : subtotal
                }
              />
              <button
                onClick={() => {
                  setDiscount(discountType, 0);
                  setShowDiscount(false);
                }}
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
          <div className="flex shrink-0 items-center justify-between border-t border-gray-100 bg-emerald-50 px-4 py-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
              <PiTag className="h-3 w-3 shrink-0" />
              <span className="truncate">{selectedPricelist.name}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedPricelist(null);
                toast('Standard pricing restored', { icon: '↩️' });
              }}
              className="ml-2 shrink-0 rounded p-0.5 text-emerald-500 hover:bg-emerald-100 hover:text-emerald-700"
              title="Clear pricelist"
            >
              <PiX className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* ── Pricelist price breakdown (shown when pricelist is active) ── */}
        {selectedPricelist &&
          items.some((item) => {
            const { steps } = computeItemPriceChain(item, selectedPricelist);
            return steps.length > 0;
          }) && (
            <div className="shrink-0 border-t border-gray-100 bg-gray-50/50 px-4 py-2">
              <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-400">
                Price adjustments from {selectedPricelist.name}
              </p>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const { steps } = computeItemPriceChain(
                    item,
                    selectedPricelist
                  );
                  if (!steps.length) return null;
                  return (
                    <div
                      key={item.subProductId + (item.sizeId || '')}
                      className="flex items-start gap-2 text-[10px]"
                    >
                      <span className="max-w-[100px] truncate text-gray-500">
                        {item.name}
                        {item.variant ? ` (${item.variant})` : ''}
                      </span>
                      <span className="shrink-0 text-gray-400">
                        ×{item.quantity}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {steps.map((s, i) => {
                          const totalAdj = s.saving * item.quantity;
                          const isSaving = totalAdj > 0;
                          return (
                            <span
                              key={i}
                              className={`rounded px-1.5 py-0.5 font-semibold ${isSaving ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}
                            >
                              {s.label}: {isSaving ? '-' : '+'}
                              {formatCurrency(Math.abs(totalAdj))}
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
          {appliedRewards
            .filter((r) => r.kind !== 'bxgy')
            .map((r) => (
              <div
                key={r.id}
                className="mb-0.5 flex items-center justify-between text-xs"
              >
                <span
                  className="flex min-w-0 items-center gap-1.5 truncate"
                  style={{ color: r.color ?? '#b20202' }}
                >
                  <PiStar className="h-3 w-3 shrink-0" />
                  <span className="truncate font-semibold">{r.name}</span>
                  {r.code && (
                    <span className="font-mono font-bold tracking-wider">
                      ({r.code})
                    </span>
                  )}
                </span>
                <span className="ml-2 flex shrink-0 items-center gap-1">
                  <span
                    className="font-bold"
                    style={{ color: r.color ?? '#b20202' }}
                  >
                    -
                    {formatCurrency(
                      computeRewardDiscount(
                        r,
                        items,
                        Math.max(0, subtotal - discountAmount)
                      )
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeReward(r.id)}
                    className="text-gray-300 transition-colors hover:text-red-400"
                  >
                    <PiX className="h-3 w-3" />
                  </button>
                </span>
              </div>
            ))}
          <div className="flex items-baseline justify-between">
            <span className="text-base font-bold text-gray-900">Total</span>
            <span
              className={`text-lg font-bold ${selectedPricelist ? 'text-emerald-700' : 'text-gray-900'}`}
            >
              {formatCurrency(total)}
            </span>
          </div>
        </div>

        {/* ── Warehouse selector ── */}
        {warehouses.length > 0 && (
          <div className="flex items-center gap-2 border-t border-gray-100 bg-gray-50/60 px-3 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Warehouse
            </span>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700 focus:border-[#b20202] focus:outline-none"
            >
              <option value="">— select —</option>
              {warehouses.map((w) => (
                <option key={w._id} value={w._id}>
                  {w.name}
                  {w.isDefault ? ' ✓' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ── Action bar ── */}
        {(() => {
          const barBtns = [
            <button
              key="customer"
              type="button"
              onClick={() => setShowCustomer(true)}
              className={`flex items-center justify-center gap-1 bg-white py-2.5 text-[11px] font-medium transition-colors hover:bg-gray-50 ${hasCustomer ? 'text-[#b20202]' : 'text-gray-600'}`}
            >
              <PiUser className="h-3.5 w-3.5" />
              {hasCustomer ? customerLabel.split(' ')[0] : 'Customer'}
            </button>,
            settings.allowOrderNotes ? (
              <button
                key="note"
                type="button"
                onClick={() => setShowNote(!showNote)}
                className={`flex items-center justify-center gap-1 bg-white py-2.5 text-[11px] font-medium transition-colors hover:bg-gray-50 ${note ? 'text-[#b20202]' : 'text-gray-600'}`}
              >
                <PiNotePencil className="h-3.5 w-3.5" />
                Note
              </button>
            ) : null,
            settings.holdOrders ? (
              <button
                key="hold"
                type="button"
                onClick={handleHold}
                className="flex items-center justify-center gap-1 bg-white py-2.5 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                <PiNote className="h-3.5 w-3.5" />
                Hold
              </button>
            ) : null,
            settings.holdOrders ? (
              <button
                key="held-orders"
                type="button"
                onClick={() => setShowHeldOrders(true)}
                className="flex items-center justify-center gap-1 bg-white py-2.5 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                <PiArrowCounterClockwise className="h-3.5 w-3.5" />
                Held
              </button>
            ) : null,
            <button
              key="rewards"
              type="button"
              onClick={() => setShowRewards(true)}
              className={`relative flex items-center justify-center gap-1 bg-white py-2.5 text-[11px] font-medium transition-colors hover:bg-gray-50 ${appliedRewards.length > 0 ? 'text-[#b20202]' : 'text-gray-600'}`}
            >
              <PiStar className="h-3.5 w-3.5" />
              Rewards
              {appliedRewards.length > 0 ? ` (${appliedRewards.length})` : ''}
              {appliedRewards.length > 0 && (
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#b20202]" />
              )}
            </button>,
            <button
              key="actions"
              type="button"
              onClick={() => setShowActions(true)}
              className="flex items-center justify-center gap-1 bg-white py-2.5 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              <PiList className="h-3.5 w-3.5" />
              Actions
            </button>,
          ].filter(Boolean);
          return (
            <div
              className="shrink-0 gap-px border-t border-gray-200 bg-gray-200"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${barBtns.length}, 1fr)`,
              }}
            >
              {barBtns}
            </div>
          );
        })()}

        {/* ── Numpad ── */}
        <div className="shrink-0 border-t border-gray-200 bg-gray-50 p-2">
          {disabled ? (
            <div className="flex h-[196px] items-center justify-center">
              <p className="text-xs text-gray-400">
                Add a product to use the dialpad
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1.5">
              {numpadRows.map((row, ri) => (
                <React.Fragment key={ri}>
                  {row.map((key) => {
                    let cls =
                      'bg-white border border-gray-200 text-gray-800 hover:bg-gray-100';
                    if (key === '+/-')
                      cls =
                        'bg-amber-100 border border-amber-200 text-amber-800 hover:bg-amber-200';
                    if (key === '.')
                      cls =
                        'bg-orange-50 border border-orange-100 text-orange-600 hover:bg-orange-100';
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
                      disabled={
                        (modeRows[ri] === 'disc' && !canDiscount) ||
                        (modeRows[ri] === 'price' && settings.priceControl)
                      }
                      title={
                        modeRows[ri] === 'disc' && !canDiscount
                          ? 'No discount permission'
                          : undefined
                      }
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
        {(() => {
          const needsCustomer =
            settings.requireCustomer && !customer.customerId;
          const belowMin =
            settings.minimumOrderAmount > 0 &&
            total < settings.minimumOrderAmount;
          const btnDisabled = items.length === 0 || needsCustomer || belowMin;
          const btnTitle = needsCustomer
            ? 'Select a customer first'
            : belowMin
              ? `Minimum order: ₦${settings.minimumOrderAmount.toLocaleString()}`
              : undefined;
          return (
            <button
              type="button"
              onClick={handleCheckout}
              disabled={btnDisabled}
              title={btnTitle}
              className="shrink-0 py-4 text-base font-bold text-white transition-colors disabled:opacity-40"
              style={{ backgroundColor: '#b20202' }}
            >
              {needsCustomer
                ? 'Select a customer first'
                : belowMin
                  ? `Minimum order: ₦${settings.minimumOrderAmount.toLocaleString()}`
                  : 'Payment'}
            </button>
          );
        })()}
      </div>

      {/* Modals */}
      {showActions && (
        <ActionsModal
          onDiscount={() => setShowDiscount(true)}
          onNote={() => setShowNote(true)}
          onPricelist={() => setShowPricelist(true)}
          onReward={() => setShowRewards(true)}
          onQuotationOrder={() => setShowOrderPicker(true)}
          onCancelOrder={() => {
            clearCart();
            setLinkedSalesOrderId(null);
            setSelectedKey(null);
            setDialInput('');
          }}
          onClose={() => setShowActions(false)}
        />
      )}

      {showOrderPicker && token && (
        <POSOrderPickerModal
          token={token}
          onLoad={handleLoadOrder}
          onClose={() => setShowOrderPicker(false)}
        />
      )}

      {showRewards && <RewardsModal onClose={() => setShowRewards(false)} />}

      {showPricelist && token && (
        <PricelistModal token={token} onClose={() => setShowPricelist(false)} />
      )}

      {showCustomer && (
        <CustomerModal
          current={customer}
          token={token}
          onSelectCustomer={handleSetCustomer}
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

      {showHeldOrders && (
        <HeldOrdersModal
          token={token}
          onRecall={(cart) => {
            // Set customer
            if (cart.customer?.firstName) {
              setCustomer(cart.customer);
            }
            // Set note
            if (cart.note) setNote(cart.note);
            // Set discount
            if (cart.discountValue > 0) {
              setDiscount(cart.discountType, cart.discountValue);
            }
            // Add items — skip price 0 placeholders; the grid re-prices them
            for (const ci of cart.items) {
              addItem({
                subProductId: ci.subProductId,
                productId: ci.productId,
                sizeId: ci.sizeId,
                name: ci.name,
                variant: ci.variant,
                sku: ci.sku,
                quantity: ci.quantity,
                price: ci.price,
                discount: ci.discount,
                stock: 999, // client re-fetches from grid on mount
              });
            }
            setShowHeldOrders(false);
            toast.success('Order recalled', { icon: '↩️' });
          }}
          onClose={() => setShowHeldOrders(false)}
        />
      )}
    </>
  );
}

// ── Held Orders Modal ──────────────────────────────────────────────────────────
function HeldOrdersModal({
  token,
  onRecall,
  onClose,
}: {
  token: string | null;
  onRecall: (
    cart: import('@/app/shared/point-of-sale/types').POSRecallCart
  ) => void;
  onClose: () => void;
}) {
  const [orders, setOrders] = useState<
    import('@/app/shared/point-of-sale/types').POSHoldOrder[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [recalling, setRecalling] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    posApi
      .getHeldOrders(token)
      .then((data) => setOrders(data.orders || []))
      .catch(() => setError('Could not load held orders'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleRecall(id: string) {
    if (!token || recalling) return;
    setRecalling(id);
    try {
      const data = await posApi.recallHeldOrder(token, id);
      onRecall(data.cart);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to recall order'
      );
    } finally {
      setRecalling(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[80vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-md sm:rounded-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Held Orders</h2>
            <p className="text-[11px] text-gray-400">
              Saved carts waiting to be recalled
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <PiX className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-gray-400">
              <PiSpinner className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : error ? (
            <p className="px-5 py-8 text-center text-xs text-red-500">
              {error}
            </p>
          ) : orders.length === 0 ? (
            <div className="py-12 text-center">
              <PiNote className="mx-auto mb-2 h-8 w-8 text-gray-300" />
              <p className="text-xs text-gray-400">No held orders</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {orders.map((o) => (
                <div
                  key={o._id}
                  className="flex items-center justify-between px-5 py-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {o.customer}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {o.itemCount} item{o.itemCount !== 1 ? 's' : ''}
                      {o.note ? ` · ${o.note}` : ''}
                    </p>
                    <p className="text-[10px] text-gray-300">
                      {new Date(o.createdAt).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRecall(o._id)}
                    disabled={recalling === o._id}
                    className="ml-3 shrink-0 rounded-lg bg-[#b20202] px-4 py-2 text-[11px] font-semibold text-white transition-colors hover:bg-[#910101] disabled:opacity-50"
                  >
                    {recalling === o._id ? (
                      <PiSpinner className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      'Recall'
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-gray-100 py-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

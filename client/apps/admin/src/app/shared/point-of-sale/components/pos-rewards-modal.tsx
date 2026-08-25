'use client';

import { useState } from 'react';
import {
  PiX,
  PiCheckCircle,
  PiTicket,
  PiStar,
  PiLightning,
  PiShoppingCart,
  PiWarning,
  PiCoins,
} from 'react-icons/pi';
import {
  usePOSCart,
  usePOSAuth,
  usePOSPricelist,
  usePOSProducts,
  computeRewardDiscount,
  itemMatchesApplicableItems,
} from '@/app/shared/point-of-sale/store';
import type { CartAppliedReward } from '@/app/shared/point-of-sale/store';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';

export default function RewardsModal({ onClose }: { onClose: () => void }) {
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

'use client';

import React from 'react';
import * as Icon from 'react-icons/pi';

interface PackPricingCardProps {
  currencySymbol: string;
  sizeLabel?: string;
  packUnitPrice: number;
  packThreshold: number;
  packSavingsPct: number | null;
  normalPrice: number;
  quantity: number;
  packRateActive: boolean;
  packThresholdRemaining: number;
  onQuickAddPack?: () => void;
  /** Trims the side-by-side price comparison for narrow surfaces (quickview modal). */
  compact?: boolean;
}

const formatPrice = (v: number) =>
  v >= 1000
    ? v.toLocaleString('en-NG', { maximumFractionDigits: 0 })
    : v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const PackPricingCard: React.FC<PackPricingCardProps> = ({
  currencySymbol,
  sizeLabel,
  packUnitPrice,
  packThreshold,
  packSavingsPct,
  normalPrice,
  quantity,
  packRateActive,
  onQuickAddPack,
  compact = false,
}) => {
  const units = packRateActive ? quantity : packThreshold;
  const normalTotal = normalPrice * units;
  const packTotal = packUnitPrice * units;
  const totalSavings = normalTotal - packTotal;
  const progressPct = Math.min(100, Math.round((quantity / packThreshold) * 100));

  return (
    <div
      className={`relative rounded-2xl overflow-hidden motion-safe:transition-all motion-safe:duration-300 ${
        packRateActive
          ? 'ring-2 ring-amber-400 shadow-lg shadow-amber-200/40'
          : 'ring-1 ring-amber-200 shadow-sm'
      }`}
    >
      {/* Gradient background */}
      <div
        className={`absolute inset-0 motion-safe:transition-opacity motion-safe:duration-300 ${
          packRateActive
            ? 'bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100'
            : 'bg-gradient-to-br from-amber-50/80 via-white to-orange-50/60'
        }`}
      />

      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center motion-safe:transition-colors ${
                packRateActive
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-300/50'
                  : 'bg-amber-100 text-amber-600'
              }`}
            >
              <Icon.PiArchive size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-amber-900">
                  {packRateActive ? 'Pack Rate Active' : 'Bulk Pack Offer'}
                </span>
                {packRateActive && (
                  <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-700">
                    <Icon.PiCheckCircleFill size={11} />
                    Applied
                  </span>
                )}
              </div>
              <span className="text-[11px] text-amber-600">
                {packRateActive
                  ? `You're paying ${currencySymbol}${formatPrice(packUnitPrice)} per unit`
                  : `Buy ${packThreshold}+ units to unlock pack pricing`}
              </span>
            </div>
          </div>
          {packSavingsPct != null && (
            <div
              className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-xl motion-safe:transition-colors ${
                packRateActive
                  ? 'bg-amber-500 text-white'
                  : 'bg-amber-200/80 text-amber-800'
              }`}
            >
              <span className="text-base font-bold leading-none">
                {packSavingsPct}%
              </span>
              <span className="text-[8px] uppercase tracking-wider leading-none mt-0.5">
                OFF
              </span>
            </div>
          )}
        </div>

        {sizeLabel && <p className="px-4 pb-3 text-xs text-amber-800">Selected size: {sizeLabel}</p>}

        {/* Price comparison row — the quickview modal already shows both prices
            in its header, so compact mode drops this grid. */}
        <div className={`px-4 pb-3 ${compact ? 'hidden' : ''}`}>
          <div className="grid grid-cols-2 gap-2">
            {/* Normal price */}
            <div
              className={`rounded-xl px-3 py-2.5 text-center motion-safe:transition-all ${
                packRateActive
                  ? 'bg-white/60 opacity-60'
                  : 'bg-white/80 ring-1 ring-gray-200'
              }`}
            >
              <div className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">
                Single-unit price
              </div>
              <div className={`font-bold ${packRateActive ? 'text-gray-400 line-through text-base' : 'text-gray-700 text-lg'}`}>
                {currencySymbol}{formatPrice(normalPrice)}
              </div>
              <div className="text-[9px] text-gray-400">per unit</div>
            </div>
            {/* Pack price */}
            <div
              className={`rounded-xl px-3 py-2.5 text-center motion-safe:transition-all ring-1 ${
                packRateActive
                  ? 'bg-amber-100 ring-amber-300'
                  : 'bg-amber-50 ring-amber-200'
              }`}
            >
              <div className="text-[9px] uppercase tracking-wider text-amber-500 mb-0.5">
                Bulk unit price
              </div>
              <div className="font-bold text-lg text-amber-700">
                {currencySymbol}{formatPrice(packUnitPrice)}
              </div>
              <div className="text-[9px] text-amber-500">per unit at {packThreshold}+</div>
            </div>
          </div>
        </div>

        {/* Savings summary */}
        <div className="mx-4 mb-3 rounded-lg bg-amber-100/60 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span className="text-amber-700 font-medium">
            Pack total · {units} units
          </span>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className="text-gray-400 line-through">
              {currencySymbol}{formatPrice(normalTotal)}
            </span>
            <Icon.PiArrowRight size={10} className="text-amber-500" />
            <span className="font-bold text-amber-800">
              {currencySymbol}{formatPrice(packTotal)}
            </span>
            <span className="flex items-center gap-0.5 text-green-600 font-semibold">
              <Icon.PiArrowDown size={10} />
              Save {currencySymbol}{formatPrice(totalSavings)}
            </span>
          </div>
        </div>

        {/* Progress bar (only when not yet unlocked) */}
        {!packRateActive && (
          <div className="px-4 pb-3">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="font-semibold text-amber-700">
                {quantity} of {packThreshold} units
              </span>
              {onQuickAddPack && <button
                type="button"
                onClick={onQuickAddPack}
                className="flex min-h-11 items-center gap-1 rounded-lg bg-amber-800 px-3 text-xs font-bold text-white hover:bg-amber-900 motion-safe:transition-colors"
              >
                <Icon.PiPlus size={9} />
                Select {packThreshold} units
              </button>}
            </div>
            <div role="progressbar" aria-label="Progress toward pack pricing" aria-valuenow={progressPct}
              className="h-2 rounded-full bg-amber-200/50 overflow-hidden">
              <div className="h-full rounded-full bg-amber-600 motion-safe:transition-[width] motion-safe:duration-300"
                style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}

        {/* Unlocked celebration */}
        {packRateActive && (
          <div className="px-4 pb-4">
            <div className="flex items-center justify-center gap-2 py-2 rounded-xl bg-amber-500/10 ring-1 ring-amber-300/50">
              <Icon.PiCheckCircleFill size={16} className="text-amber-600" />
              <span className="text-xs font-bold text-amber-700">
                Pack rate applied to all {quantity} units
              </span>
              {quantity > packThreshold && (
                <span className="text-[10px] text-amber-500">
                  ({quantity} × {currencySymbol}{formatPrice(packUnitPrice)})
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(PackPricingCard);
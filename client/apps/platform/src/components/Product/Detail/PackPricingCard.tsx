'use client';

import React from 'react';
import * as Icon from 'react-icons/pi';

interface PackPricingCardProps {
  currencySymbol: string;
  packUnitPrice: number;
  packThreshold: number;
  packSavingsPct: number | null;
  normalPrice: number;
  quantity: number;
  packRateActive: boolean;
  packThresholdRemaining: number;
  onQuickAddPack?: () => void;
}

const formatPrice = (v: number) =>
  v >= 1000
    ? v.toLocaleString('en-NG', { maximumFractionDigits: 0 })
    : v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const PackPricingCard: React.FC<PackPricingCardProps> = ({
  currencySymbol,
  packUnitPrice,
  packThreshold,
  packSavingsPct,
  normalPrice,
  quantity,
  packRateActive,
  packThresholdRemaining,
  onQuickAddPack,
}) => {
  const normalTotal = normalPrice * packThreshold;
  const packTotal = packUnitPrice * packThreshold;
  const totalSavings = normalTotal - packTotal;
  const progressPct = Math.min(100, Math.round((quantity / packThreshold) * 100));

  return (
    <div
      className={`relative rounded-2xl overflow-hidden transition-all duration-300 ${
        packRateActive
          ? 'ring-2 ring-amber-400 shadow-lg shadow-amber-200/40'
          : 'ring-1 ring-amber-200 shadow-sm'
      }`}
    >
      {/* Gradient background */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          packRateActive
            ? 'bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100'
            : 'bg-gradient-to-br from-amber-50/80 via-white to-orange-50/60'
        }`}
      />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
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
                  <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-600 animate-pulse">
                    <Icon.PiCheckCircleFill size={11} />
                    LIVE
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
              className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-xl transition-colors ${
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

        {/* Price comparison row */}
        <div className="px-4 pb-3">
          <div className="grid grid-cols-2 gap-2">
            {/* Normal price */}
            <div
              className={`rounded-xl px-3 py-2.5 text-center transition-all ${
                packRateActive
                  ? 'bg-white/60 opacity-60'
                  : 'bg-white/80 ring-1 ring-gray-200'
              }`}
            >
              <div className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">
                {packRateActive ? 'Was' : 'Normal'}
              </div>
              <div className={`font-bold ${packRateActive ? 'text-gray-400 line-through text-base' : 'text-gray-700 text-lg'}`}>
                {currencySymbol}{formatPrice(normalPrice)}
              </div>
              <div className="text-[9px] text-gray-400">per unit</div>
            </div>
            {/* Pack price */}
            <div
              className={`rounded-xl px-3 py-2.5 text-center transition-all ring-1 ${
                packRateActive
                  ? 'bg-amber-100 ring-amber-300 scale-105'
                  : 'bg-amber-50 ring-amber-200'
              }`}
            >
              <div className="text-[9px] uppercase tracking-wider text-amber-500 mb-0.5">
                Pack Price
              </div>
              <div className="font-bold text-lg text-amber-700">
                {currencySymbol}{formatPrice(packUnitPrice)}
              </div>
              <div className="text-[9px] text-amber-500">per unit at {packThreshold}+</div>
            </div>
          </div>
        </div>

        {/* Savings summary */}
        <div className="mx-4 mb-3 rounded-lg bg-amber-100/60 px-3 py-2 flex items-center justify-between text-[11px]">
          <span className="text-amber-700 font-medium">
            At {packThreshold} units:
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 line-through">
              {currencySymbol}{formatPrice(normalTotal)}
            </span>
            <Icon.PiArrowRight size={10} className="text-amber-500" />
            <span className="font-bold text-amber-800">
              {currencySymbol}{formatPrice(packTotal)}
            </span>
            <span className="flex items-center gap-0.5 text-green-600 font-semibold">
              <Icon.PiArrowDown size={10} />
              {currencySymbol}{formatPrice(totalSavings)}
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
              <button
                onClick={onQuickAddPack}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold hover:bg-amber-600 transition-colors"
              >
                <Icon.PiPlus size={9} />
                Add {packThresholdRemaining} to unlock
              </button>
            </div>
            <div className="h-2.5 rounded-full bg-amber-200/50 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-orange-500 transition-all duration-500 ease-out relative overflow-hidden"
                style={{ width: `${progressPct}%` }}
              >
                {progressPct > 0 && progressPct < 100 && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
                )}
              </div>
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
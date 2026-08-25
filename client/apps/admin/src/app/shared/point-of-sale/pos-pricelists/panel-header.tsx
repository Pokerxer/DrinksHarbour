'use client';

import React from 'react';
import {
  PiSpinner,
  PiFloppyDisk,
  PiX,
} from 'react-icons/pi';
import { BRAND } from '@/app/shared/point-of-sale/pricelist-constants';

interface Props {
  name: string;
  currency: string;
  website: string;
  selectable: boolean;
  isDefault: boolean;
  dirty: boolean;
  saving: boolean;
  activeCount: number;
  expiredCount: number;
  currencyLabel?: string;
  onNameChange(v: string): void;
  onCurrencyChange(v: string): void;
  onWebsiteChange(v: string): void;
  onSelectableChange(v: boolean): void;
  onIsDefaultChange(v: boolean): void;
  onSave(): void;
  onClose(): void;
}

export default function PanelHeader({
  name,
  currency,
  website,
  selectable,
  isDefault,
  dirty,
  saving,
  activeCount,
  expiredCount,
  currencyLabel,
  onNameChange,
  onCurrencyChange,
  onWebsiteChange,
  onSelectableChange,
  onIsDefaultChange,
  onSave,
  onClose,
}: Props) {
  return (
    <>
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <input
              aria-label="Pricelist name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              className="min-w-0 flex-1 truncate bg-transparent text-sm font-bold text-gray-900 outline-none focus:text-gray-700"
              placeholder="Pricelist name"
            />
            {selectable && !dirty && (
              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                Selectable
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[10px] text-gray-400">
            {currencyLabel || 'NGN'} · {activeCount} rule
            {activeCount !== 1 ? 's' : ''}
            {expiredCount > 0 ? ` · ${expiredCount} expired` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {dirty && (
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: BRAND }}
            >
              {saving ? (
                <PiSpinner className="h-3 w-3 animate-spin" />
              ) : (
                <PiFloppyDisk className="h-3 w-3" />
              )}
              Save
            </button>
          )}
          <button
            type="button"
            aria-label="Close panel"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <PiX className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex shrink-0 items-center gap-3 border-b border-gray-100 bg-gray-50/50 px-4 py-2 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="text-gray-400">Currency</span>
          <select
            aria-label="Currency"
            value={currency}
            onChange={(e) => onCurrencyChange(e.target.value)}
            className="border-0 bg-transparent text-xs font-semibold text-gray-700 outline-none"
          >
            <option>NGN</option>
            <option>USD</option>
            <option>EUR</option>
            <option>GBP</option>
          </select>
        </div>
        <div className="h-3 w-px bg-gray-200" />
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="shrink-0 text-gray-400">Website</span>
          <input
            aria-label="Website"
            value={website}
            onChange={(e) => onWebsiteChange(e.target.value)}
            className="min-w-0 flex-1 border-0 bg-transparent text-xs font-semibold text-gray-700 outline-none placeholder:font-normal placeholder:text-gray-300"
            placeholder="None"
          />
        </div>
        <div className="h-3 w-px bg-gray-200" />
        <label className="flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={selectable}
            onChange={(e) => onSelectableChange(e.target.checked)}
            className="h-3.5 w-3.5 rounded accent-[#b20202]"
          />
          <span className="text-gray-500">Selectable</span>
        </label>
        <div className="h-3 w-px bg-gray-200" />
        <label className="flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => onIsDefaultChange(e.target.checked)}
            className="h-3.5 w-3.5 rounded accent-[#b20202]"
          />
          <span className="text-gray-500">Default</span>
        </label>
      </div>
    </>
  );
}

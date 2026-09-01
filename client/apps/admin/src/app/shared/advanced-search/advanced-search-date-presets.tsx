'use client';

import { PiCheck } from 'react-icons/pi';
import { DATE_PRESETS } from './filter-config-data';

interface Props {
  activeDatePreset: string | null;
  onSetDatePreset: (presetId: string | null) => void;
  dateFrom: string;
  dateTo: string;
  onDateFrom: (v: string) => void;
  onDateTo: (v: string) => void;
  /**
   * Label/id pairs to offer. Defaults to the SalesOrder creation-date presets.
   * The inventory stock browser passes expiry presets instead, because StockRow
   * has no createdAt — its only date is earliestExpiry.
   */
  presets?: { id: string; label: string }[];
  /** How to bucket the presets under sub-headings. One flat group by default. */
  presetGroups?: { label: string; ids: string[] }[];
}

const SALES_PRESET_GROUPS: { label: string; ids: string[] }[] = [
  { label: 'Quick', ids: ['today', 'yesterday', 'last7'] },
  { label: 'Week', ids: ['this-week'] },
  { label: 'Month', ids: ['this-month', 'last-month'] },
  { label: 'Quarter', ids: ['this-quarter', 'last-quarter'] },
  { label: 'Year', ids: ['this-year', 'last-year'] },
];

export default function AdvancedSearchDatePresets({
  activeDatePreset, onSetDatePreset,
  dateFrom, dateTo, onDateFrom, onDateTo,
  presets = DATE_PRESETS,
  presetGroups,
}: Props) {
  const isCustom = activeDatePreset === 'custom';
  // 'custom' has its own control below the groups; listing it twice would give
  // the user two switches for one piece of state.
  const groups = presetGroups
    ?? (presets === DATE_PRESETS
      ? SALES_PRESET_GROUPS
      : [{ label: 'Range', ids: presets.filter((p) => p.id !== 'custom').map((p) => p.id) }]);

  return (
    <div>
      {groups.map((group) => (
        <div key={group.label} className="mb-2">
          <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            {group.label}
          </p>
          <div className="flex flex-wrap gap-1 px-1">
            {group.ids.map((id) => {
              const preset = presets.find((p) => p.id === id);
              if (!preset) return null;
              const isActive = activeDatePreset === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSetDatePreset(isActive ? null : id)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {isActive && <PiCheck className="h-3 w-3" />}
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="mt-2 border-t border-gray-100 pt-2">
        <button
          type="button"
          onClick={() => onSetDatePreset(isCustom ? null : 'custom')}
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            isCustom
              ? 'border-brand bg-brand/10 text-brand'
              : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          {isCustom && <PiCheck className="h-3 w-3" />}
          Custom Range
        </button>

        {isCustom && (
          <div className="mt-2 flex items-center gap-2 px-1">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFrom(e.target.value)}
              className="block w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
              placeholder="From"
            />
            <span className="text-[10px] text-gray-400">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => onDateTo(e.target.value)}
              className="block w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
              placeholder="To"
            />
          </div>
        )}
      </div>
    </div>
  );
}

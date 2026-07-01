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
}

const PRESET_GROUPS: { label: string; ids: string[] }[] = [
  { label: 'Quick', ids: ['today', 'yesterday', 'last7'] },
  { label: 'Week', ids: ['this-week'] },
  { label: 'Month', ids: ['this-month', 'last-month'] },
  { label: 'Quarter', ids: ['this-quarter', 'last-quarter'] },
  { label: 'Year', ids: ['this-year', 'last-year'] },
];

export default function AdvancedSearchDatePresets({
  activeDatePreset, onSetDatePreset,
  dateFrom, dateTo, onDateFrom, onDateTo,
}: Props) {
  const isCustom = activeDatePreset === 'custom';

  return (
    <div>
      {PRESET_GROUPS.map((group) => (
        <div key={group.label} className="mb-2">
          <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            {group.label}
          </p>
          <div className="flex flex-wrap gap-1 px-1">
            {group.ids.map((id) => {
              const preset = DATE_PRESETS.find((p) => p.id === id);
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

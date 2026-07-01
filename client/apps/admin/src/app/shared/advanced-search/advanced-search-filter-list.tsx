'use client';

import { useState, useMemo } from 'react';
import { PiMagnifyingGlass, PiCheck, PiX } from 'react-icons/pi';
import type { FilterConfig, FilterValue, FilterFieldType } from './advanced-search-types';
import { FILTER_CONFIGS } from './filter-config-data';

interface Props {
  activeFilters: FilterValue[];
  onAddFilter: (filter: FilterValue) => void;
  onRemoveFilter: (fieldId: string) => void;
}

function FilterValueEditor({
  config,
  onApply,
  onClose,
}: {
  config: FilterConfig;
  onApply: (value: FilterValue) => void;
  onClose: () => void;
}) {
  const [textVal, setTextVal] = useState('');
  const [numVal, setNumVal] = useState('');
  const [numVal2, setNumVal2] = useState('');
  const [boolVal, setBoolVal] = useState(false);
  const [selectVal, setSelectVal] = useState('');
  const [multiVal, setMultiVal] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  function commit() {
    const fieldId = config.id;
    const label = config.label;
    switch (config.type) {
      case 'text': {
        onApply({ fieldId, operator: 'contains', value: textVal, label: `${label}: ${textVal}` });
        break;
      }
      case 'number': {
        const n = parseFloat(numVal);
        if (!isNaN(n)) onApply({ fieldId, operator: 'equals', value: n, label: `${label}: ${n}` });
        break;
      }
      case 'number-range': {
        const n1 = parseFloat(numVal);
        const n2 = parseFloat(numVal2);
        if (!isNaN(n1) && !isNaN(n2)) onApply({ fieldId, operator: 'between', value: [String(n1), String(n2)] as [string, string], label: `${label}: ${n1} - ${n2}` });
        break;
      }
      case 'date': {
        if (dateFrom) onApply({ fieldId, operator: 'equals', value: dateFrom, label: `${label}: ${dateFrom}` });
        break;
      }
      case 'date-range': {
        if (dateFrom && dateTo) onApply({ fieldId, operator: 'between', value: [dateFrom, dateTo] as [string, string], label: `${label}: ${dateFrom} - ${dateTo}` });
        break;
      }
      case 'select': {
        if (selectVal) onApply({ fieldId, operator: 'equals', value: selectVal, label: `${label}: ${selectVal}` });
        break;
      }
      case 'multi-select': {
        if (multiVal.length) onApply({ fieldId, operator: 'in', value: multiVal, label: `${label}: ${multiVal.join(', ')}` });
        break;
      }
      case 'boolean': {
        onApply({ fieldId, operator: 'equals', value: boolVal, label: `${label}: ${boolVal ? 'Yes' : 'No'}` });
        break;
      }
    }
    onClose();
  }

  const inputCls = "w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-brand";

  return (
    <div className="border-t border-gray-100 bg-gray-50/50 px-3 py-2">
      {config.type === 'text' && (
        <input type="text" value={textVal} onChange={(e) => setTextVal(e.target.value)} placeholder={config.placeholder ?? 'Value...'} className={inputCls} autoFocus />
      )}
      {config.type === 'number' && (
        <input type="number" value={numVal} onChange={(e) => setNumVal(e.target.value)} placeholder="Value..." className={inputCls} autoFocus />
      )}
      {config.type === 'number-range' && (
        <div className="flex items-center gap-1.5">
          <input type="number" value={numVal} onChange={(e) => setNumVal(e.target.value)} placeholder="Min" className={inputCls} autoFocus />
          <span className="text-gray-400">-</span>
          <input type="number" value={numVal2} onChange={(e) => setNumVal2(e.target.value)} placeholder="Max" className={inputCls} />
        </div>
      )}
      {config.type === 'date' && (
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} autoFocus />
      )}
      {config.type === 'date-range' && (
        <div className="flex items-center gap-1.5">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} autoFocus />
          <span className="text-gray-400">-</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputCls} />
        </div>
      )}
      {config.type === 'select' && config.options && (
        <select value={selectVal} onChange={(e) => setSelectVal(e.target.value)} className={inputCls} autoFocus>
          <option value="">Select...</option>
          {config.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
      {config.type === 'multi-select' && config.options && (
        <div className="max-h-32 space-y-1 overflow-y-auto">
          {config.options.map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={multiVal.includes(o.value)}
                onChange={(e) => setMultiVal(e.target.checked ? [...multiVal, o.value] : multiVal.filter((v) => v !== o.value))}
                className="h-3.5 w-3.5 rounded border-gray-300 text-brand focus:ring-brand"
              />
              {o.label}
            </label>
          ))}
        </div>
      )}
      {config.type === 'boolean' && (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={boolVal}
            onChange={(e) => setBoolVal(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-gray-300 text-brand focus:ring-brand"
          />
          Yes
        </label>
      )}
      <div className="mt-2 flex justify-end gap-1.5">
        <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100">Cancel</button>
        <button type="button" onClick={commit} className="rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-dark">Apply</button>
      </div>
    </div>
  );
}

export default function AdvancedSearchFilterList({ activeFilters, onAddFilter, onRemoveFilter }: Props) {
  const [search, setSearch] = useState('');
  const [editingFilter, setEditingFilter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search) return FILTER_CONFIGS;
    return FILTER_CONFIGS.filter((f) => f.label.toLowerCase().includes(search.toLowerCase()));
  }, [search]);

  const isActive = (id: string) => activeFilters.some((f) => f.fieldId === id);

  function handleApply(config: FilterConfig, value: FilterValue) {
    onAddFilter(value);
    setEditingFilter(null);
  }

  return (
    <div>
      <div className="relative">
        <PiMagnifyingGlass className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search 64 filters..."
          className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-7 pr-3 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-brand focus:bg-white focus:ring-1 focus:ring-brand/20"
        />
      </div>
      <div className="mt-2 max-h-64 space-y-0.5 overflow-y-auto custom-scrollbar">
        {filtered.map((config) => (
          <div key={config.id}>
            <button
              type="button"
              onClick={() => setEditingFilter(editingFilter === config.id ? null : config.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-all hover:bg-gray-50 ${
                isActive(config.id) ? 'text-brand font-medium' : 'text-gray-700'
              }`}
            >
              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                isActive(config.id) ? 'border-brand bg-brand' : 'border-gray-300 bg-white'
              }`}>
                {isActive(config.id) && <PiCheck className="h-2.5 w-2.5 text-white" />}
              </span>
              <span className="flex-1 truncate">{config.label}</span>
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-gray-400">{config.category}</span>
              {isActive(config.id) && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); onRemoveFilter(config.id); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onRemoveFilter(config.id); } }}
                  className="shrink-0 cursor-pointer rounded-md p-1 text-gray-400 opacity-70 transition-all hover:bg-red-50 hover:text-red-500 hover:opacity-100"
                  aria-label={`Remove ${config.label}`}
                >
                  <PiX className="h-3 w-3" />
                </span>
              )}
            </button>
            {editingFilter === config.id && (
              <FilterValueEditor config={config} onApply={(v) => handleApply(config, v)} onClose={() => setEditingFilter(null)} />
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="px-2 py-6 text-center text-sm text-gray-400">No filters match</p>
        )}
      </div>
    </div>
  );
}

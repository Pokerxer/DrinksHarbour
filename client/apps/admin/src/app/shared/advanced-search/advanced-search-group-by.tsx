'use client';

import { useState } from 'react';
import { PiCheck, PiPlus, PiCaretRight, PiX, PiFolder } from 'react-icons/pi';
import type { CustomGroup } from './advanced-search-types';
import { GROUP_BY_OPTIONS, FILTER_CATEGORIES } from './filter-config-data';

interface Props {
  groupBy: string;
  groupBySubOption?: string;
  onSetGroupBy: (id: string, subOption?: string) => void;
  customGroups: CustomGroup[];
  onAddCustomGroup: (group: CustomGroup) => void;
  onRemoveCustomGroup: (id: string) => void;
}

export default function AdvancedSearchGroupBy({
  groupBy,
  groupBySubOption,
  onSetGroupBy,
  customGroups,
  onAddCustomGroup,
  onRemoveCustomGroup,
}: Props) {
  const [expandedOption, setExpandedOption] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');

  function handleSelect(id: string, subOption?: string) {
    if (groupBy === id && groupBySubOption === subOption) {
      onSetGroupBy('none');
    } else {
      onSetGroupBy(id, subOption);
    }
  }

  function addCustom() {
    const name = customName.trim();
    if (!name) return;
    const group: CustomGroup = {
      id: `custom-${Date.now()}`,
      label: name,
      field: '',
      values: [],
    };
    onAddCustomGroup(group);
    setCustomName('');
  }

  return (
    <div>
      <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
        Group By
      </p>
      {GROUP_BY_OPTIONS.map((opt) => {
        const isActive = groupBy === opt.id;
        const hasSub = opt.subOptions && opt.subOptions.length > 0;
        const isExpanded = expandedOption === opt.id;
        return (
          <div key={opt.id}>
            <button
              type="button"
              onClick={() => {
                if (hasSub) {
                  setExpandedOption(isExpanded ? null : opt.id);
                } else {
                  handleSelect(opt.id);
                }
              }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 ${
                isActive ? 'font-semibold text-brand' : 'text-gray-700'
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  isActive ? 'border-brand bg-brand' : 'border-gray-300 bg-white'
                }`}
              >
                {isActive && <PiCheck className="h-3 w-3 text-white" />}
              </span>
              <span className="flex-1 text-left">{opt.label}</span>
              {hasSub && (
                <PiCaretRight
                  className={`h-3 w-3 text-gray-400 transition-transform ${
                    isExpanded ? 'rotate-90' : ''
                  }`}
                />
              )}
            </button>
            {hasSub && isExpanded && (
              <div className="ml-6 border-l border-gray-100 pl-2">
                {opt.subOptions!.map((sub) => {
                  const isSubActive = isActive && groupBySubOption === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => handleSelect(opt.id, sub.id)}
                      className={`flex w-full items-center gap-2 px-2 py-1 text-sm hover:bg-gray-50 ${
                        isSubActive ? 'font-semibold text-brand' : 'text-gray-600'
                      }`}
                    >
                      <span
                        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
                          isSubActive ? 'border-brand bg-brand' : 'border-gray-300 bg-white'
                        }`}
                      >
                        {isSubActive && <PiCheck className="h-2.5 w-2.5 text-white" />}
                      </span>
                      {sub.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div className="mt-3 border-t border-gray-100 px-3 pt-3">
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
          <PiFolder className="h-3.5 w-3.5" />
          Categories
        </p>
        {FILTER_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => {
              const isSelected = groupBy === cat.id;
              onSetGroupBy(isSelected ? '' : cat.id);
            }}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors hover:bg-gray-50 ${
              groupBy === cat.id ? 'font-semibold text-brand' : 'text-gray-700'
            }`}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                groupBy === cat.id ? 'border-brand bg-brand' : 'border-gray-300 bg-white'
              }`}
            >
              {groupBy === cat.id && <PiCheck className="h-3 w-3 text-white" />}
            </span>
            {cat.label}
          </button>
        ))}
      </div>

      <div className="mt-3 border-t border-gray-100 px-3 pt-3">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Custom Group
        </p>
        {customGroups.map((g) => (
          <div
            key={g.id}
            className="group flex items-center gap-2 px-2 py-1 text-sm text-gray-700"
          >
            <span className="flex-1 truncate">{g.label}</span>
            <button
              type="button"
              onClick={() => onRemoveCustomGroup(g.id)}
              className="rounded p-0.5 text-gray-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
              aria-label={`Remove custom group ${g.label}`}
            >
              <PiX className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <div className="mt-1.5 flex items-center gap-1">
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addCustom(); }}
            placeholder="Group name..."
            className="min-w-0 flex-1 rounded-md border border-gray-200 px-2 py-1 text-xs outline-none focus:border-brand"
          />
          <button
            type="button"
            onClick={addCustom}
            disabled={!customName.trim()}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-brand px-2 py-1 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            <PiPlus className="h-3 w-3" />
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

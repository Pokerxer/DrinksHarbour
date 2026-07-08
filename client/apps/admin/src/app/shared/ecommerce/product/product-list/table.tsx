// @ts-nocheck
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { routes } from '@/config/routes';
import Table from '@core/components/table';
import { useTanStackTable } from '@core/components/table/custom/use-TanStack-Table';
import TablePagination from '@core/components/table/pagination';
import { productsListColumns } from './columns';
import type { ProductListItem } from './columns';
import TableFooter from '@core/components/table/footer';
import { TableClassNameProps } from '@core/components/table/table-types';
import cn from '@core/utils/class-names';
import { exportToCSV } from '@core/utils/export-to-csv';
import { productService } from '@/services/product.service';
import { Text, Flex } from 'rizzui';
import {
  PiArrowsClockwiseBold,
  PiPackageBold,
  PiWarningBold,
  PiDownloadBold,
  PiCheckCircleBold,
  PiXCircleBold,
  PiFunnelBold,
  PiMagnifyingGlass,
  PiCaretDown,
  PiCaretUp,
  PiCaretRight,
  PiX,
  PiFunnel,
  PiStack,
  PiStar,
  PiFloppyDisk,
  PiTrash,
  PiPlus,
  PiSparkle,
} from 'react-icons/pi';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

// Import shared list components
import {
  ColumnToggle,
  ProductGridCard,
  ProductGridCardCompact,
  ViewToggle,
} from './components';
import type { FilterConfig, ViewMode } from './components';

// ── Custom filter rule types ────────────────────────────────────────────────────
type RuleOperator =
  | '='
  | '!='
  | '>'
  | '<'
  | '>='
  | '<='
  | 'contains'
  | 'not_contains'
  | 'is_set'
  | 'is_not_set'
  | 'in'
  | 'not_in';
type FieldType = 'text' | 'number' | 'boolean' | 'date' | 'select';
interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
}
interface CustomRule {
  id: string;
  fieldKey: string;
  operator: RuleOperator;
  value: string;
}

const CUSTOM_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Product Name', type: 'text' },
  { key: 'productType', label: 'Product Type', type: 'text' },
  { key: 'category', label: 'Category', type: 'text' },
  { key: 'subCategory', label: 'Subcategory', type: 'text' },
  { key: 'brand', label: 'Brand / Vendor', type: 'text' },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'approved', label: 'Approved' },
      { value: 'draft', label: 'Draft' },
      { value: 'pending', label: 'Pending' },
      { value: 'discontinued', label: 'Discontinued' },
      { value: 'archived', label: 'Archived' },
      { value: 'rejected', label: 'Rejected' },
    ],
  },
  { key: 'isPublished', label: 'Published', type: 'boolean' },
  { key: 'isAlcoholic', label: 'Alcoholic', type: 'boolean' },
  { key: 'abv', label: 'ABV (%)', type: 'number' },
  { key: 'volumeMl', label: 'Volume (ml)', type: 'number' },
  { key: 'originCountry', label: 'Origin Country', type: 'text' },
  { key: 'totalStock', label: 'Total Stock', type: 'number' },
  { key: 'variantCount', label: 'Variant Count', type: 'number' },
  { key: 'createdAt', label: 'Date Added', type: 'date' },
];

function getOperatorsForType(
  type: FieldType
): { value: RuleOperator; label: string }[] {
  if (type === 'boolean')
    return [
      { value: '=', label: 'is' },
      { value: '!=', label: 'is not' },
    ];
  if (type === 'text')
    return [
      { value: 'contains', label: 'contains' },
      { value: 'not_contains', label: 'does not contain' },
      { value: '=', label: '=' },
      { value: '!=', label: '≠' },
      { value: 'is_set', label: 'is set' },
      { value: 'is_not_set', label: 'is not set' },
    ];
  if (type === 'number')
    return [
      { value: '=', label: '=' },
      { value: '!=', label: '≠' },
      { value: '>', label: '>' },
      { value: '<', label: '<' },
      { value: '>=', label: '≥' },
      { value: '<=', label: '≤' },
      { value: 'is_set', label: 'is set' },
      { value: 'is_not_set', label: 'is not set' },
    ];
  if (type === 'date')
    return [
      { value: '=', label: '=' },
      { value: '!=', label: '≠' },
      { value: '>', label: 'after' },
      { value: '<', label: 'before' },
      { value: '>=', label: 'on or after' },
      { value: '<=', label: 'on or before' },
      { value: 'is_set', label: 'is set' },
      { value: 'is_not_set', label: 'is not set' },
    ];
  if (type === 'select')
    return [
      { value: '=', label: '=' },
      { value: '!=', label: '≠' },
      { value: 'is_set', label: 'is set' },
      { value: 'is_not_set', label: 'is not set' },
    ];
  return [{ value: '=', label: '=' }];
}

function getRuleValue(product: any, fieldKey: string): any {
  switch (fieldKey) {
    case 'name':
      return product.name || '';
    case 'productType':
      return product.type || '';
    case 'category':
      return product.category?.name || '';
    case 'subCategory':
      return product.subCategory?.name || '';
    case 'brand':
      return product.brand?.name || '';
    case 'status':
      return product.status || '';
    case 'isPublished':
      return product.isPublished ? 'true' : 'false';
    case 'isAlcoholic':
      return product.isAlcoholic ? 'true' : 'false';
    case 'abv':
      return product.abv ?? 0;
    case 'volumeMl':
      return product.volumeMl ?? 0;
    case 'originCountry':
      return product.originCountry || '';
    case 'totalStock':
      return product.totalStock ?? 0;
    case 'variantCount':
      return product.variantCount ?? product.subProductCount ?? 0;
    case 'createdAt':
      return product.createdAt || '';
    default:
      return '';
  }
}

function applyRule(product: any, rule: CustomRule): boolean {
  const field = CUSTOM_FIELDS.find((f) => f.key === rule.fieldKey);
  if (!field) return true;
  const actual = getRuleValue(product, rule.fieldKey);
  const v = rule.value;
  if (rule.operator === 'is_set')
    return actual !== '' && actual !== null && actual !== undefined;
  if (rule.operator === 'is_not_set')
    return actual === '' || actual === null || actual === undefined;
  if (field.type === 'number') {
    const n = parseFloat(actual);
    const rv = parseFloat(v);
    if (isNaN(rv)) return true;
    switch (rule.operator) {
      case '=':
        return n === rv;
      case '!=':
        return n !== rv;
      case '>':
        return n > rv;
      case '<':
        return n < rv;
      case '>=':
        return n >= rv;
      case '<=':
        return n <= rv;
    }
  }
  if (field.type === 'date') {
    const d = new Date(actual).getTime();
    const rv = new Date(v).getTime();
    if (isNaN(rv)) return true;
    switch (rule.operator) {
      case '=':
        return d === rv;
      case '!=':
        return d !== rv;
      case '>':
        return d > rv;
      case '<':
        return d < rv;
      case '>=':
        return d >= rv;
      case '<=':
        return d <= rv;
    }
  }
  const str = String(actual).toLowerCase();
  const vs = v.toLowerCase();
  switch (rule.operator) {
    case 'contains':
      return str.includes(vs);
    case 'not_contains':
      return !str.includes(vs);
    case '=':
      return str === vs;
    case '!=':
      return str !== vs;
  }
  return true;
}

// ── Custom Filter Modal ─────────────────────────────────────────────────────────
function CustomFilterModal({
  onAdd,
  onCancel,
}: {
  onAdd: (
    rules: CustomRule[],
    matchMode: 'any' | 'all',
    includeArchived: boolean
  ) => void;
  onCancel: () => void;
}) {
  const [rules, setRules] = useState<CustomRule[]>([
    { id: '1', fieldKey: 'name', operator: 'contains', value: '' },
  ]);
  const [matchMode, setMatchMode] = useState<'any' | 'all'>('any');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [fieldPickerFor, setFieldPickerFor] = useState<string | null>(null);
  const [fieldSearch, setFieldSearch] = useState('');

  function addRule() {
    setRules((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        fieldKey: 'name',
        operator: 'contains',
        value: '',
      },
    ]);
  }
  function removeRule(id: string) {
    setRules((prev) => prev.filter((r) => r.id !== id));
  }
  function updateRule(id: string, patch: Partial<CustomRule>) {
    setRules((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, ...patch };
        if (patch.fieldKey) {
          const f = CUSTOM_FIELDS.find((f) => f.key === patch.fieldKey);
          if (f) updated.operator = getOperatorsForType(f.type)[0].value;
          updated.value = '';
        }
        return updated;
      })
    );
  }

  const filteredFields = CUSTOM_FIELDS.filter((f) =>
    f.label.toLowerCase().includes(fieldSearch.toLowerCase())
  );

  // Every rule must have a value unless its operator is is_set / is_not_set
  const isValid = rules.every(
    (r) =>
      r.operator === 'is_set' ||
      r.operator === 'is_not_set' ||
      String(r.value).trim() !== ''
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const inputCls =
    'rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition-all focus:border-[#b20202] focus:ring-1 focus:ring-[#b20202]/20';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10">
        {/* Header — brand gradient */}
        <div className="flex items-center justify-between bg-gradient-to-r from-[#b20202] to-[#7f1d1d] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
              <PiFunnel className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                Add Custom Filter
              </h2>
              <p className="text-[11px] text-red-200">
                Build rules to filter your product list
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
          >
            <PiX className="h-4 w-4" />
          </button>
        </div>

        {/* Match mode + Include archived bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Match</span>
            <select
              value={matchMode}
              onChange={(e) => setMatchMode(e.target.value as any)}
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-sm font-semibold text-[#b20202] outline-none focus:border-[#b20202]"
            >
              <option value="any">any</option>
              <option value="all">all</option>
            </select>
            <span>of the following rules:</span>
          </div>
          <button
            type="button"
            onClick={() => setIncludeArchived((v) => !v)}
            className="flex items-center gap-2 text-sm text-gray-600"
          >
            <div
              className={`relative h-5 w-9 rounded-full transition-all ${includeArchived ? 'bg-[#b20202]' : 'bg-gray-200'}`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${includeArchived ? 'translate-x-4' : 'translate-x-0.5'}`}
              />
            </div>
            Include archived
          </button>
        </div>

        {/* Rules */}
        <div className="max-h-[50vh] space-y-2.5 overflow-y-auto px-4 py-4 sm:px-6">
          {rules.map((rule, idx) => {
            const field = CUSTOM_FIELDS.find((f) => f.key === rule.fieldKey)!;
            const operators = getOperatorsForType(field?.type || 'text');
            const needsValue =
              rule.operator !== 'is_set' && rule.operator !== 'is_not_set';
            const isPickerOpen = fieldPickerFor === rule.id;

            return (
              <div
                key={rule.id}
                className="group flex flex-wrap items-center gap-2 sm:flex-nowrap"
              >
                {/* Rule number */}
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#b20202]/10 text-[10px] font-bold text-[#b20202]">
                  {idx + 1}
                </span>

                {/* Field picker */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setFieldPickerFor(isPickerOpen ? null : rule.id);
                      setFieldSearch('');
                    }}
                    className={`flex min-w-[155px] items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${isPickerOpen ? 'border-[#b20202] bg-[#b20202]/5 text-[#b20202]' : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300 hover:bg-white'}`}
                  >
                    {field?.label || 'Select field'}
                    <PiCaretDown
                      className={`h-3 w-3 shrink-0 transition-transform ${isPickerOpen ? 'rotate-180 text-[#b20202]' : 'text-gray-400'}`}
                    />
                  </button>
                  {isPickerOpen && (
                    <div className="absolute left-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/10">
                      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                        <span className="text-xs font-bold text-gray-800">
                          Select a field
                        </span>
                        <button
                          type="button"
                          onClick={() => setFieldPickerFor(null)}
                          className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        >
                          <PiX className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="border-b border-gray-100 px-3 py-2">
                        <div className="relative">
                          <PiMagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                          <input
                            autoFocus
                            type="text"
                            placeholder="Search fields…"
                            value={fieldSearch}
                            onChange={(e) => setFieldSearch(e.target.value)}
                            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-[#b20202] focus:bg-white"
                          />
                        </div>
                      </div>
                      <div className="max-h-52 overflow-y-auto py-1">
                        {filteredFields.map((f) => (
                          <button
                            key={f.key}
                            type="button"
                            onClick={() => {
                              updateRule(rule.id, { fieldKey: f.key });
                              setFieldPickerFor(null);
                            }}
                            className={`flex w-full items-center gap-2 px-4 py-2.5 text-sm transition-colors ${f.key === rule.fieldKey ? 'bg-[#b20202]/8 font-semibold text-[#b20202]' : 'text-gray-700 hover:bg-gray-50'}`}
                          >
                            {f.key === rule.fieldKey && (
                              <span className="h-1.5 w-1.5 rounded-full bg-[#b20202]" />
                            )}
                            {f.label}
                          </button>
                        ))}
                        {filteredFields.length === 0 && (
                          <p className="px-4 py-6 text-center text-xs text-gray-400">
                            No fields match "{fieldSearch}"
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Operator */}
                <select
                  value={rule.operator}
                  onChange={(e) =>
                    updateRule(rule.id, {
                      operator: e.target.value as RuleOperator,
                    })
                  }
                  className={`${inputCls} min-w-[130px]`}
                >
                  {operators.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>

                {/* Value */}
                {needsValue ? (
                  field?.type === 'boolean' ? (
                    <select
                      value={rule.value || 'true'}
                      onChange={(e) =>
                        updateRule(rule.id, { value: e.target.value })
                      }
                      className={`${inputCls} flex-1`}
                    >
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  ) : field?.type === 'select' ? (
                    <select
                      value={rule.value}
                      onChange={(e) =>
                        updateRule(rule.id, { value: e.target.value })
                      }
                      className={`${inputCls} flex-1`}
                    >
                      <option value="">Select…</option>
                      {field.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={
                        field?.type === 'date'
                          ? 'date'
                          : field?.type === 'number'
                            ? 'number'
                            : 'text'
                      }
                      value={rule.value}
                      onChange={(e) =>
                        updateRule(rule.id, { value: e.target.value })
                      }
                      placeholder="Value…"
                      className={`${inputCls} flex-1`}
                    />
                  )
                ) : (
                  <div className="flex-1" />
                )}

                {/* Row actions */}
                <div className="flex shrink-0 items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={addRule}
                    title="Add another rule"
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition-colors hover:border-[#b20202] hover:bg-[#b20202]/5 hover:text-[#b20202]"
                  >
                    <PiPlus className="h-3.5 w-3.5" />
                  </button>
                  {rules.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRule(rule.id)}
                      title="Remove rule"
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-500"
                    >
                      <PiTrash className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* New Rule */}
          <button
            type="button"
            onClick={addRule}
            className="flex items-center gap-1.5 pt-1 text-sm font-medium text-[#b20202] transition-colors hover:text-[#7f1d1d]"
          >
            <PiPlus className="h-4 w-4" />
            New Rule
          </button>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 bg-gray-50 px-4 py-4 sm:px-6">
          <button
            type="button"
            disabled={!isValid}
            onClick={() => onAdd(rules, matchMode, includeArchived)}
            className="rounded-xl bg-[#b20202] px-6 py-2.5 text-sm font-bold text-white shadow-sm shadow-[#b20202]/30 transition-all hover:bg-[#7f1d1d] hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#b20202] disabled:hover:shadow-sm"
          >
            Apply Filter
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
          <span className="ml-auto text-xs text-gray-400">
            {!isValid
              ? 'Fill in every rule value to apply'
              : rules.length > 1
                ? `${rules.length} rules · match ${matchMode}`
                : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Odoo-style search panel types & constants ──────────────────────────────────
type SPFilterKey =
  | 'published'
  | 'low_stock'
  | 'out_of_stock'
  | 'archived'
  | 'alcoholic'
  | 'non_alcoholic';
type SPGroupKey =
  | 'product_type'
  | 'category'
  | 'brand'
  | 'status'
  | 'stock_level';
interface SPSavedSearch {
  id: string;
  name: string;
  query: string;
  filters: SPFilterKey[];
  groupBy: SPGroupKey | null;
  chips: SPSearchChip[];
}

type SPChipField = 'product' | 'category' | 'vendor' | 'type' | 'origin';
interface SPSearchChip {
  id: string;
  field: SPChipField;
  label: string;
  query: string;
}
const SP_CHIP_FIELDS: { field: SPChipField; label: string }[] = [
  { field: 'product', label: 'Product' },
  { field: 'category', label: 'Product Category' },
  { field: 'vendor', label: 'Brand / Vendor' },
  { field: 'type', label: 'Product Type' },
  { field: 'origin', label: 'Origin Country' },
];
const SP_SAVED_KEY = 'dh-product-searches';
function spLoadSaved(): SPSavedSearch[] {
  try {
    return JSON.parse(
      localStorage.getItem(SP_SAVED_KEY) || '[]'
    ) as SPSavedSearch[];
  } catch {
    return [];
  }
}
function spPersistSaved(list: SPSavedSearch[]) {
  localStorage.setItem(SP_SAVED_KEY, JSON.stringify(list));
}

const SP_FILTER_LABELS: Record<SPFilterKey, string> = {
  published: 'Published',
  low_stock: 'Low Stock',
  out_of_stock: 'Out of Stock',
  archived: 'Archived',
  alcoholic: 'Alcoholic',
  non_alcoholic: 'Non-Alcoholic',
};
const SP_GROUP_LABELS: Record<SPGroupKey, string> = {
  product_type: 'Product Type',
  category: 'Product Category',
  brand: 'Brand',
  status: 'Status',
  stock_level: 'Stock Level',
};

// ── OdooSearchPanel component ─────────────────────────────────────────────────
function OdooSearchPanel({
  activeFilters,
  groupBy,
  savedSearches,
  onToggleFilter,
  onSetGroupBy,
  onSave,
  onLoadSaved,
  onDeleteSaved,
  onClose,
  advancedFilters,
  onAdvancedFilterChange,
  onReset,
  activeFilterCount,
  onAddCustomFilter,
}: {
  activeFilters: Set<SPFilterKey>;
  groupBy: SPGroupKey | null;
  savedSearches: SPSavedSearch[];
  onToggleFilter: (f: SPFilterKey) => void;
  onSetGroupBy: (g: SPGroupKey | null) => void;
  onSave: (name: string) => void;
  onLoadSaved: (s: SPSavedSearch) => void;
  onDeleteSaved: (id: string) => void;
  onClose: () => void;
  advancedFilters: FilterConfig;
  onAdvancedFilterChange: (f: FilterConfig) => void;
  onReset: () => void;
  activeFilterCount: number;
  onAddCustomFilter: () => void;
}) {
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advTab, setAdvTab] = useState<'basic' | 'beverage' | 'dates'>('basic');
  const ref = useRef<HTMLDivElement>(null);

  function upd<K extends keyof FilterConfig>(key: K, value: FilterConfig[K]) {
    onAdvancedFilterChange({ ...advancedFilters, [key]: value });
  }

  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onOut);
    return () => document.removeEventListener('mousedown', onOut);
  }, [onClose]);

  function FilterItem({ fkey, label }: { fkey: SPFilterKey; label: string }) {
    const on = activeFilters.has(fkey);
    return (
      <button
        type="button"
        onClick={() => onToggleFilter(fkey)}
        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${on ? 'bg-[#b20202]/8 font-semibold text-[#b20202]' : 'text-gray-700 hover:bg-gray-50'}`}
      >
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${on ? 'border-[#b20202] bg-[#b20202]' : 'border-gray-300'}`}
        >
          {on && <span className="h-2 w-2 rounded-sm bg-white" />}
        </span>
        {label}
      </button>
    );
  }

  function GroupItem({ gkey, label }: { gkey: SPGroupKey; label: string }) {
    const on = groupBy === gkey;
    return (
      <button
        type="button"
        onClick={() => onSetGroupBy(on ? null : gkey)}
        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${on ? 'bg-[#b20202]/8 font-semibold text-[#b20202]' : 'text-gray-700 hover:bg-gray-50'}`}
      >
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${on ? 'border-[#b20202]' : 'border-gray-300'}`}
        >
          {on && <span className="h-2 w-2 rounded-full bg-[#b20202]" />}
        </span>
        {label}
      </button>
    );
  }

  return (
    <div
      ref={ref}
      className="ring-black/8 absolute left-0 right-0 top-full z-50 mt-1 max-h-[70vh] overflow-y-auto rounded-2xl bg-white shadow-xl ring-1 sm:min-w-[660px]"
    >
      <div className="flex flex-col divide-y divide-gray-100 sm:flex-row sm:divide-x sm:divide-y-0">
        {/* Filters */}
        <div className="flex-1 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
            <PiFunnel className="h-3.5 w-3.5" /> Filters
          </div>
          <div className="space-y-0.5">
            <FilterItem fkey="published" label="Published" />
            <div className="my-1.5 border-t border-gray-100" />
            <FilterItem fkey="low_stock" label="Low Stock" />
            <FilterItem fkey="out_of_stock" label="Out of Stock" />
            <div className="my-1.5 border-t border-gray-100" />
            <FilterItem fkey="alcoholic" label="Alcoholic" />
            <FilterItem fkey="non_alcoholic" label="Non-Alcoholic" />
            <div className="my-1.5 border-t border-gray-100" />
            <FilterItem fkey="archived" label="Archived" />
            <div className="my-1.5 border-t border-gray-100" />
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-[#b20202] transition-colors hover:bg-red-50"
              >
                {showAdvanced ? (
                  <PiCaretUp className="h-3.5 w-3.5" />
                ) : (
                  <PiCaretDown className="h-3.5 w-3.5" />
                )}
                Filter Presets
                {activeFilterCount > 0 && (
                  <span className="ml-auto rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-[#b20202]">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={onAddCustomFilter}
                className="whitespace-nowrap rounded-lg border border-[#b20202]/30 px-2.5 py-1.5 text-xs font-semibold text-[#b20202] transition-colors hover:bg-red-50"
              >
                + Custom Filter
              </button>
            </div>
          </div>
        </div>

        {/* Group By */}
        <div className="flex-1 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
            <PiStack className="h-3.5 w-3.5" /> Group By
          </div>
          <div className="space-y-0.5">
            <GroupItem gkey="product_type" label="Product Type" />
            <GroupItem gkey="category" label="Product Category" />
            <GroupItem gkey="brand" label="Brand" />
            <GroupItem gkey="status" label="Status" />
            <GroupItem gkey="stock_level" label="Stock Level" />
          </div>
        </div>

        {/* Favorites */}
        <div className="flex-1 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
            <PiStar className="h-3.5 w-3.5" /> Favorites
          </div>
          <div className="space-y-1">
            {!showSaveInput ? (
              <button
                type="button"
                onClick={() => setShowSaveInput(true)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <PiFloppyDisk className="h-4 w-4 text-gray-400" /> Save current
                search
              </button>
            ) : (
              <div className="space-y-2 px-3 py-2">
                <input
                  autoFocus
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && saveName.trim()) {
                      onSave(saveName.trim());
                      setSaveName('');
                      setShowSaveInput(false);
                    }
                    if (e.key === 'Escape') setShowSaveInput(false);
                  }}
                  placeholder="Search name…"
                  className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-[#b20202]"
                />
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (saveName.trim()) {
                        onSave(saveName.trim());
                        setSaveName('');
                        setShowSaveInput(false);
                      }
                    }}
                    disabled={!saveName.trim()}
                    className="flex-1 rounded-lg bg-[#b20202] py-1.5 text-xs font-bold text-white disabled:opacity-40"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSaveName('');
                      setShowSaveInput(false);
                    }}
                    className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {savedSearches.length > 0 && (
              <div className="mt-2 space-y-0.5 border-t border-gray-100 pt-2">
                {savedSearches.map((s) => (
                  <div key={s.id} className="group flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        onLoadSaved(s);
                        onClose();
                      }}
                      className="flex flex-1 items-center gap-2 truncate rounded-lg px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <PiStar className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                      <span className="truncate">{s.name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSaved(s.id)}
                      className="hidden h-6 w-6 shrink-0 items-center justify-center rounded text-gray-300 hover:text-red-500 group-hover:flex"
                    >
                      <PiTrash className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Advanced filter panel — full-width below 3 columns */}
      {showAdvanced && (
        <div className="border-t border-gray-100">
          {/* Tabs */}
          <div className="flex border-b border-gray-100 bg-gray-50 px-2">
            {(['basic', 'beverage', 'dates'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setAdvTab(tab)}
                className={`relative px-4 py-2 text-xs font-medium capitalize transition-colors ${advTab === tab ? 'border-b-2 border-[#b20202] text-[#b20202]' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {tab}
              </button>
            ))}
            <div className="ml-auto flex items-center pr-3">
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={onReset}
                  className="text-xs font-medium text-red-500 hover:text-red-700"
                >
                  Reset all
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="max-h-56 divide-y divide-gray-100 overflow-y-auto">
            {advTab === 'basic' && (
              <div className="grid grid-cols-1 divide-y divide-gray-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                {/* Left: Status + Stock */}
                <div className="space-y-4 p-4">
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Product Status
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { v: 'approved', l: 'Approved' },
                        { v: 'draft', l: 'Draft' },
                        { v: 'pending', l: 'Pending' },
                        { v: 'discontinued', l: 'Discontinued' },
                        { v: 'archived', l: 'Archived' },
                        { v: 'rejected', l: 'Rejected' },
                      ].map((o) => (
                        <button
                          key={o.v}
                          type="button"
                          onClick={() =>
                            upd(
                              'status',
                              advancedFilters.status.includes(o.v)
                                ? advancedFilters.status.filter(
                                    (x) => x !== o.v
                                  )
                                : [...advancedFilters.status, o.v]
                            )
                          }
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${advancedFilters.status.includes(o.v) ? 'border-[#b20202] bg-[#b20202] text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-[#b20202]/40'}`}
                        >
                          {o.l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Stock Status
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { v: 'in_stock', l: 'In Stock' },
                        { v: 'low_stock', l: 'Low Stock' },
                        { v: 'out_of_stock', l: 'Out of Stock' },
                      ].map((o) => (
                        <button
                          key={o.v}
                          type="button"
                          onClick={() =>
                            upd(
                              'stockStatus',
                              advancedFilters.stockStatus.includes(o.v)
                                ? advancedFilters.stockStatus.filter(
                                    (x) => x !== o.v
                                  )
                                : [...advancedFilters.stockStatus, o.v]
                            )
                          }
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${advancedFilters.stockStatus.includes(o.v) ? 'border-[#b20202] bg-[#b20202] text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-[#b20202]/40'}`}
                        >
                          {o.l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Right: Flags + Variants */}
                <div className="space-y-3 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Product Flags
                  </p>
                  {[
                    { k: 'isPublished' as const, l: 'Published' },
                    { k: 'hasVariants' as const, l: 'Has Variants' },
                    { k: 'isAlcoholic' as const, l: 'Alcoholic' },
                  ].map(({ k, l }) => (
                    <div key={k} className="flex items-center justify-between">
                      <span className="text-xs text-gray-700">{l}</span>
                      <div className="flex">
                        <button
                          type="button"
                          onClick={() =>
                            upd(k, advancedFilters[k] === true ? null : true)
                          }
                          className={`rounded-l border px-2 py-0.5 text-[10px] font-semibold transition-all ${advancedFilters[k] === true ? 'border-green-500 bg-green-500 text-white' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            upd(k, advancedFilters[k] === false ? null : false)
                          }
                          className={`rounded-r border-b border-r border-t px-2 py-0.5 text-[10px] font-semibold transition-all ${advancedFilters[k] === false ? 'border-red-500 bg-red-500 text-white' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}
                        >
                          No
                        </button>
                      </div>
                    </div>
                  ))}
                  <p className="pt-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Variant Count
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { l: 'None', r: [0, 0] },
                      { l: '1–3', r: [1, 3] },
                      { l: '4–10', r: [4, 10] },
                      { l: '10+', r: [10, 1000] },
                    ].map((p) => {
                      const on =
                        advancedFilters.variantsRange[0] === p.r[0] &&
                        advancedFilters.variantsRange[1] === p.r[1];
                      return (
                        <button
                          key={p.l}
                          type="button"
                          onClick={() =>
                            upd(
                              'variantsRange',
                              on ? [0, 0] : (p.r as [number, number])
                            )
                          }
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${on ? 'border-[#b20202] bg-[#b20202] text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-[#b20202]/40'}`}
                        >
                          {p.l}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {advTab === 'beverage' && (
              <div className="space-y-4 p-4">
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Beverage Type
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { v: 'wine', l: 'Wine🍷' },
                      { v: 'beer', l: 'Beer🍺' },
                      { v: 'whiskey', l: 'Whiskey🥃' },
                      { v: 'vodka', l: 'Vodka🍸' },
                      { v: 'gin', l: 'Gin🍸' },
                      { v: 'rum', l: 'Rum🍹' },
                      { v: 'tequila', l: 'Tequila🌵' },
                      { v: 'champagne', l: 'Champagne🥂' },
                      { v: 'soft_drink', l: 'Soft Drink🥤' },
                      { v: 'juice', l: 'Juice🧃' },
                      { v: 'water', l: 'Water💧' },
                      { v: 'cocktail', l: 'Cocktail🍹' },
                    ].map((o) => (
                      <button
                        key={o.v}
                        type="button"
                        onClick={() =>
                          upd(
                            'beverageTypes',
                            advancedFilters.beverageTypes.includes(o.v)
                              ? advancedFilters.beverageTypes.filter(
                                  (x) => x !== o.v
                                )
                              : [...advancedFilters.beverageTypes, o.v]
                          )
                        }
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${advancedFilters.beverageTypes.includes(o.v) ? 'border-[#b20202] bg-[#b20202] text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-[#b20202]/40'}`}
                      >
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Origin Country
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { v: 'NG', l: '🇳🇬 Nigeria' },
                      { v: 'FR', l: '🇫🇷 France' },
                      { v: 'IT', l: '🇮🇹 Italy' },
                      { v: 'ES', l: '🇪🇸 Spain' },
                      { v: 'US', l: '🇺🇸 USA' },
                      { v: 'GB', l: '🇬🇧 UK' },
                      { v: 'DE', l: '🇩🇪 Germany' },
                      { v: 'ZA', l: '🇿🇦 S.Africa' },
                      { v: 'AU', l: '🇦🇺 Australia' },
                      { v: 'SC', l: '🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scotland' },
                    ].map((o) => (
                      <button
                        key={o.v}
                        type="button"
                        onClick={() =>
                          upd(
                            'originCountries',
                            advancedFilters.originCountries.includes(o.v)
                              ? advancedFilters.originCountries.filter(
                                  (x) => x !== o.v
                                )
                              : [...advancedFilters.originCountries, o.v]
                          )
                        }
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${advancedFilters.originCountries.includes(o.v) ? 'border-[#b20202] bg-[#b20202] text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-[#b20202]/40'}`}
                      >
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      ABV
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { l: 'Non-Alc', r: [0, 0.5] },
                        { l: '0.5–5%', r: [0.5, 5] },
                        { l: '5–15%', r: [5, 15] },
                        { l: '15–40%', r: [15, 40] },
                        { l: '40%+', r: [40, 100] },
                      ].map((p) => {
                        const on =
                          advancedFilters.abvRange[0] === p.r[0] &&
                          advancedFilters.abvRange[1] === p.r[1];
                        return (
                          <button
                            key={p.l}
                            type="button"
                            onClick={() =>
                              upd(
                                'abvRange',
                                on ? [0, 0] : (p.r as [number, number])
                              )
                            }
                            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${on ? 'border-[#b20202] bg-[#b20202] text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-[#b20202]/40'}`}
                          >
                            {p.l}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Volume
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { l: '<250ml', r: [0, 250] },
                        { l: '250–500ml', r: [250, 500] },
                        { l: '500–750ml', r: [500, 750] },
                        { l: '750ml–1L', r: [750, 1000] },
                        { l: '1L+', r: [1000, 10000] },
                      ].map((p) => {
                        const on =
                          advancedFilters.volumeRange[0] === p.r[0] &&
                          advancedFilters.volumeRange[1] === p.r[1];
                        return (
                          <button
                            key={p.l}
                            type="button"
                            onClick={() =>
                              upd(
                                'volumeRange',
                                on ? [0, 0] : (p.r as [number, number])
                              )
                            }
                            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${on ? 'border-[#b20202] bg-[#b20202] text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-[#b20202]/40'}`}
                          >
                            {p.l}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {advTab === 'dates' && (
              <div className="space-y-2 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Date Added
                </p>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={advancedFilters.dateRange.from}
                    onChange={(e) =>
                      upd('dateRange', {
                        ...advancedFilters.dateRange,
                        from: e.target.value,
                      })
                    }
                    className="h-8 flex-1 rounded border border-gray-200 px-2 text-xs outline-none focus:border-[#b20202]"
                  />
                  <span className="self-center text-xs text-gray-400">–</span>
                  <input
                    type="date"
                    value={advancedFilters.dateRange.to}
                    onChange={(e) =>
                      upd('dateRange', {
                        ...advancedFilters.dateRange,
                        to: e.target.value,
                      })
                    }
                    className="h-8 flex-1 rounded border border-gray-200 px-2 text-xs outline-none focus:border-[#b20202]"
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {[
                    { l: 'Today', d: 0 },
                    { l: '7d', d: 7 },
                    { l: '30d', d: 30 },
                    { l: '90d', d: 90 },
                  ].map((p) => (
                    <button
                      key={p.l}
                      type="button"
                      onClick={() => {
                        const to = new Date();
                        const from = new Date();
                        from.setDate(from.getDate() - p.d);
                        upd('dateRange', {
                          from: from.toISOString().split('T')[0],
                          to: to.toISOString().split('T')[0],
                        });
                      }}
                      className="rounded bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600 transition-colors hover:bg-red-50 hover:text-[#b20202]"
                    >
                      {p.l}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Initial filter state — trimmed to product-supported fields
const initialFilters: FilterConfig = {
  status: [],
  stockStatus: [],
  isPublished: null,
  stockRange: [0, 0],
  variantsRange: [0, 0],
  hasVariants: null,
  beverageTypes: [],
  isAlcoholic: null,
  abvRange: [0, 0],
  volumeRange: [0, 0],
  originCountries: [],
  dateRange: { from: '', to: '' },
};

// ─── Loading Skeleton ────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.07 }}
          className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
        >
          <div className="h-12 w-12 flex-shrink-0 animate-pulse rounded-xl bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-1/4 animate-pulse rounded bg-gray-100" />
          </div>
          <div className="h-6 w-20 animate-pulse rounded-full bg-gray-200" />
          <div className="h-8 w-8 animate-pulse rounded-xl bg-gray-100" />
        </motion.div>
      ))}
    </div>
  );
}

function GridLoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {[...Array(10)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05 }}
          className="overflow-hidden rounded-2xl border border-gray-100 bg-white"
        >
          <div className="aspect-[3/4] animate-pulse bg-gray-200" />
          <div className="space-y-2 p-4">
            <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-gray-100" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Stats Header ─────────────────────────────────────────────────────────────
function StatsHeader({
  stats,
  activeFilter,
  onFilterChange,
}: {
  stats: {
    total: number;
    published: number;
    draft: number;
    discontinued: number;
  };
  activeFilter: string;
  onFilterChange: (f: string) => void;
}) {
  const cards = [
    {
      id: '',
      label: 'Total',
      value: stats.total,
      icon: PiPackageBold,
      color: 'blue',
    },
    {
      id: 'published',
      label: 'Published',
      value: stats.published,
      icon: PiCheckCircleBold,
      color: 'green',
    },
    {
      id: 'draft',
      label: 'Draft',
      value: stats.draft,
      icon: PiWarningBold,
      color: 'amber',
    },
    {
      id: 'discontinued',
      label: 'Discontinued',
      value: stats.discontinued,
      icon: PiXCircleBold,
      color: 'red',
    },
  ];

  const colorMap: Record<
    string,
    { bg: string; text: string; iconBg: string; ring: string }
  > = {
    blue: {
      bg: 'from-blue-500/10 to-blue-500/5',
      text: 'text-blue-600',
      iconBg: 'bg-blue-500',
      ring: 'ring-blue-500/30',
    },
    green: {
      bg: 'from-green-500/10 to-green-500/5',
      text: 'text-green-600',
      iconBg: 'bg-green-500',
      ring: 'ring-green-500/30',
    },
    amber: {
      bg: 'from-amber-500/10 to-amber-500/5',
      text: 'text-amber-600',
      iconBg: 'bg-amber-500',
      ring: 'ring-amber-500/30',
    },
    red: {
      bg: 'from-red-500/10 to-red-500/5',
      text: 'text-red-600',
      iconBg: 'bg-red-500',
      ring: 'ring-red-500/30',
    },
  };

  return (
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card, idx) => {
        const colors = colorMap[card.color];
        const isActive = activeFilter === card.id;
        const Icon = card.icon;
        return (
          <motion.button
            key={card.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08 }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onFilterChange(card.id)}
            className={cn(
              'relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-left transition-all',
              colors.bg,
              isActive && `ring-4 ${colors.ring}`
            )}
          >
            <Flex justify="between" align="start">
              <div>
                <Text
                  className={cn(
                    'text-xs font-bold uppercase tracking-wider opacity-70',
                    colors.text
                  )}
                >
                  {card.label}
                </Text>
                <motion.div
                  key={card.value}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mt-1"
                >
                  <Text className="text-3xl font-black">{card.value}</Text>
                </motion.div>
              </div>
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-lg',
                  colors.iconBg
                )}
              >
                <Icon className="h-6 w-6" />
              </motion.div>
            </Flex>
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── Bulk Actions Bar ─────────────────────────────────────────────────────────
function BulkActionsBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDelete,
  onExport,
  onArchive,
  onUnarchive,
  onClear,
  onSetStatus,
  onSetPublished,
}: {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDelete: () => void;
  onExport: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onClear: () => void;
  onSetStatus: (status: string) => void;
  onSetPublished: (value: boolean) => void;
}) {
  const [actionsOpen, setActionsOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 50, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="fixed bottom-6 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-2xl border border-gray-700/50 bg-gray-900/95 px-4 py-3 text-white shadow-2xl backdrop-blur-xl sm:gap-4 sm:px-6 sm:py-4"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#b20202]"
      >
        <Text className="text-lg font-bold">{selectedCount}</Text>
      </motion.div>
      <Text className="font-semibold">selected</Text>

      {/* Select all filtered results (Odoo pattern) */}
      {selectedCount < totalCount && (
        <button
          type="button"
          onClick={onSelectAll}
          className="flex items-center gap-1.5 rounded-lg bg-[#b20202]/90 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#b20202]"
        >
          <span aria-hidden>→</span>
          Select all {totalCount}
        </button>
      )}

      <div className="h-8 w-px bg-gray-700" />

      {/* Set status */}
      <select
        defaultValue=""
        onChange={(e) => {
          if (e.target.value) {
            onSetStatus(e.target.value);
            e.currentTarget.value = '';
          }
        }}
        className="h-9 cursor-pointer rounded-xl border border-gray-700 bg-gray-800 px-2.5 text-sm font-medium text-white outline-none transition-colors hover:bg-gray-700"
      >
        <option value="" disabled>
          Set status…
        </option>
        <option value="approved">Approved</option>
        <option value="draft">Draft</option>
        <option value="pending">Pending</option>
        <option value="discontinued">Discontinued</option>
        <option value="archived">Archived</option>
      </select>

      {/* Publish / unpublish */}
      <select
        defaultValue=""
        onChange={(e) => {
          const v = e.target.value;
          if (v) {
            onSetPublished(v === 'on');
            e.currentTarget.value = '';
          }
        }}
        className="h-9 cursor-pointer rounded-xl border border-gray-700 bg-gray-800 px-2.5 text-sm font-medium text-white outline-none transition-colors hover:bg-gray-700"
      >
        <option value="" disabled>
          Visibility…
        </option>
        <option value="on">Platform — publish</option>
        <option value="off">Platform — unpublish</option>
      </select>

      {/* Actions dropdown (Odoo pattern) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setActionsOpen((v) => !v)}
          className={cn(
            'flex h-9 items-center gap-1.5 rounded-xl border border-gray-600 px-3.5 text-sm font-semibold transition-colors',
            actionsOpen
              ? 'bg-white/10 text-white'
              : 'text-gray-200 hover:bg-white/10'
          )}
        >
          ⚙ Actions
        </button>
        {actionsOpen && (
          <div className="absolute bottom-full right-0 z-50 mb-2 w-44 overflow-hidden rounded-xl border border-gray-700 bg-gray-900 py-1 shadow-2xl">
            {[
              { label: 'Export', action: onExport },
              { label: 'Archive', action: onArchive },
              { label: 'Unarchive', action: onUnarchive },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setActionsOpen(false);
                  item.action();
                }}
                className="block w-full px-4 py-2 text-left text-sm text-gray-200 transition-colors hover:bg-white/10"
              >
                {item.label}
              </button>
            ))}
            <div className="my-1 border-t border-gray-700" />
            <button
              type="button"
              onClick={() => {
                setActionsOpen(false);
                onDelete();
              }}
              className="block w-full px-4 py-2 text-left text-sm text-red-400 transition-colors hover:bg-red-500/20"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      <div className="h-8 w-px bg-gray-700" />

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onClear}
        className="rounded-xl p-2 transition-colors hover:bg-white/10"
      >
        <PiXCircleBold className="h-5 w-5 text-gray-400" />
      </motion.button>
    </motion.div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({
  query,
  onClear,
}: {
  query?: string;
  onClear: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-gray-200 bg-white p-16 text-center"
    >
      <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-gray-100 to-gray-200">
        <PiPackageBold className="h-12 w-12 text-gray-400" />
      </div>
      <Text className="mb-2 text-2xl font-bold text-gray-700">
        No products found
      </Text>
      <Text className="mb-8 text-gray-500">
        {query
          ? `No products match "${query}". Try different search terms.`
          : 'No products match your filters.'}
      </Text>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClear}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#b20202] to-[#7f1d1d] px-8 py-3 font-semibold text-white shadow-lg shadow-[#b20202]/30 transition-all hover:shadow-xl"
      >
        <PiArrowsClockwiseBold className="h-5 w-5" />
        Clear Filters
      </motion.button>
    </motion.div>
  );
}

// ─── Error State ──────────────────────────────────────────────────────────────
function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-3xl border border-red-200 bg-white p-12 text-center"
    >
      <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-red-100">
        <PiWarningBold className="h-12 w-12 text-red-500" />
      </div>
      <Text className="mb-2 text-xl font-bold text-red-600">
        Something went wrong
      </Text>
      <Text className="mb-8 text-gray-500">{message}</Text>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-8 py-3 font-semibold text-white shadow-lg transition-all"
      >
        <PiArrowsClockwiseBold className="h-5 w-5" />
        Try Again
      </motion.button>
    </motion.div>
  );
}

// ─── Main Table Component ─────────────────────────────────────────────────────
export default function ProductsTable({
  pageSize = 10,
  hideFilters = false,
  hidePagination = false,
  hideFooter = false,
  classNames = {
    container: 'border-0 shadow-none rounded-2xl overflow-auto',
    rowClassName: 'group hover:!bg-gray-50/80 transition-all duration-200',
    headerClassName: '!bg-gradient-to-r from-gray-50 to-gray-100',
    cellClassName: 'py-3 px-2',
  },
  paginationClassName,
}: {
  pageSize?: number;
  hideFilters?: boolean;
  hidePagination?: boolean;
  hideFooter?: boolean;
  classNames?: TableClassNameProps;
  paginationClassName?: string;
}) {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [allProducts, setAllProducts] = useState<ProductListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<
    'all' | 'published' | 'draft'
  >('all');
  const [advancedFilters, setAdvancedFilters] =
    useState<FilterConfig>(initialFilters);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [gridSelection, setGridSelection] = useState<Record<string, boolean>>(
    {}
  );

  // Odoo-style search panel state
  const [spActiveFilters, setSpActiveFilters] = useState<Set<SPFilterKey>>(
    new Set()
  );
  const [spGroupBy, setSpGroupBy] = useState<SPGroupKey | null>(null);
  const [spSavedSearches, setSpSavedSearches] = useState<SPSavedSearch[]>(() =>
    spLoadSaved()
  );
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [searchChips, setSearchChips] = useState<SPSearchChip[]>([]);
  const [showCustomFilterModal, setShowCustomFilterModal] = useState(false);
  const [activeCustomRules, setActiveCustomRules] = useState<{
    rules: CustomRule[];
    matchMode: 'any' | 'all';
    includeArchived: boolean;
  } | null>(null);
  const searchPanelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close panels on outside click
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (
        searchPanelRef.current &&
        !searchPanelRef.current.contains(e.target as Node)
      ) {
        setShowSearchPanel(false);
        setShowSearchDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  function addSearchChip(field: SPChipField, label: string) {
    if (!searchQuery.trim()) return;
    const q = searchQuery.trim();
    setSearchChips((prev) => {
      const existing = prev.find((c) => c.field === field);
      if (existing) {
        // Merge into existing chip with OR
        return prev.map((c) =>
          c.id === existing.id ? { ...c, query: `${c.query} or ${q}` } : c
        );
      }
      return [...prev, { id: Date.now().toString(), field, label, query: q }];
    });
    setSearchQuery('');
    setShowSearchDropdown(false);
    setShowSearchPanel(false);
    searchInputRef.current?.focus();
  }

  function removeSearchChip(id: string) {
    setSearchChips((prev) => prev.filter((c) => c.id !== id));
  }

  function clearAll() {
    setSearchQuery('');
    setSearchChips([]);
    setSpActiveFilters(new Set());
    setSpGroupBy(null);
    setActiveCustomRules(null);
  }

  // Page size based on view mode
  const currentPageSize = useMemo(() => {
    switch (viewMode) {
      case 'list':
        return 25;
      case 'grid':
        return 25;
      case 'compact':
        return 50;
      default:
        return 25;
    }
  }, [viewMode]);

  // Handle view mode change with selection reset
  const handleViewModeChange = useCallback((newMode: ViewMode) => {
    setViewMode(newMode);
    setGridSelection({});
  }, []);

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchProducts = useCallback(
    async (isRefresh = false) => {
      if (sessionStatus !== 'authenticated' || !session?.user?.token) return;
      if (isRefresh) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);
      try {
        const res = await productService.getProducts(session.user.token, {
          limit: 500,
        });
        // API returns { success: true, data: { products: [...], pagination: {...} } }
        const raw = res?.data?.products ?? res?.products ?? [];
        const list = Array.isArray(raw) ? raw : [];
        setAllProducts(list);
        if (isRefresh) {
          toast.success(`Loaded ${list.length} products`, {
            icon: <PiSparkle className="h-5 w-5" />,
            style: {
              borderRadius: '12px',
              background: '#10b981',
              color: '#fff',
            },
          });
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load products');
        toast.error('Failed to load products');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [session?.user?.token, sessionStatus]
  );

  useEffect(() => {
    if (sessionStatus === 'authenticated') fetchProducts();
  }, [sessionStatus, fetchProducts]);

  // ── Stats ────────────────────────────────────────────────────────────────────
  const stats = useMemo(
    () => ({
      total: allProducts.length,
      published: allProducts.filter((p) => p.status === 'approved').length,
      draft: allProducts.filter(
        (p) => p.status === 'draft' || p.status === 'pending'
      ).length,
      discontinued: allProducts.filter(
        (p) =>
          p.status === 'discontinued' ||
          p.status === 'archived' ||
          p.status === 'rejected'
      ).length,
      lowStock: allProducts.filter(
        (p) => (p.totalStock ?? 0) > 0 && (p.totalStock ?? 0) <= 10
      ).length,
      outOfStock: allProducts.filter((p) => (p.totalStock ?? 0) === 0).length,
      publishedFlag: allProducts.filter((p) => p.isPublished).length,
      draftFlag: allProducts.filter((p) => !p.isPublished).length,
    }),
    [allProducts]
  );

  // ── CLIENT-SIDE FILTERING — full pipeline ────────────────────────────────────
  const filtered = useMemo(() => {
    let result = [...allProducts];

    // ═══════════════════════════════════════════════════════════
    // SEARCH FILTER
    // ═══════════════════════════════════════════════════════════
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.type?.toLowerCase().includes(q) ||
          p.brand?.name?.toLowerCase().includes(q) ||
          p.category?.name?.toLowerCase().includes(q) ||
          p.originCountry?.toLowerCase().includes(q)
      );
    }

    // Search chips — each chip's query may contain " or " terms (any term must match)
    for (const chip of searchChips) {
      const terms = chip.query
        .toLowerCase()
        .split(' or ')
        .map((t) => t.trim())
        .filter(Boolean);
      const matchesAny = (value: string | undefined) =>
        !!value && terms.some((t) => value.toLowerCase().includes(t));
      switch (chip.field) {
        case 'product':
          result = result.filter((p) => matchesAny(p.name));
          break;
        case 'category':
          result = result.filter((p) => matchesAny(p.category?.name));
          break;
        case 'vendor':
          result = result.filter((p) => matchesAny(p.brand?.name));
          break;
        case 'type':
          result = result.filter((p) => matchesAny(p.type));
          break;
        case 'origin':
          result = result.filter((p) => matchesAny(p.originCountry));
          break;
      }
    }

    // ═══════════════════════════════════════════════════════════
    // STATUS FILTER (from stats cards + pills)
    // ═══════════════════════════════════════════════════════════
    if (statusFilter) {
      switch (statusFilter) {
        case 'published':
          result = result.filter((p) => p.status === 'approved');
          break;
        case 'draft':
          result = result.filter(
            (p) => p.status === 'draft' || p.status === 'pending'
          );
          break;
        case 'discontinued':
          result = result.filter(
            (p) =>
              p.status === 'discontinued' ||
              p.status === 'archived' ||
              p.status === 'rejected'
          );
          break;
        case 'low_stock':
          result = result.filter(
            (p) => (p.totalStock ?? 0) > 0 && (p.totalStock ?? 0) <= 10
          );
          break;
        case 'out_of_stock':
          result = result.filter((p) => (p.totalStock ?? 0) === 0);
          break;
        default:
          result = result.filter((p) => p.status === statusFilter);
      }
    }

    // ═══════════════════════════════════════════════════════════
    // VISIBILITY FILTER (dropdown)
    // ═══════════════════════════════════════════════════════════
    if (visibilityFilter !== 'all') {
      switch (visibilityFilter) {
        case 'published':
          result = result.filter((p) => p.isPublished);
          break;
        case 'draft':
          result = result.filter((p) => !p.isPublished);
          break;
      }
    }

    // ═══════════════════════════════════════════════════════════
    // ADVANCED FILTERS — STATUS
    // ═══════════════════════════════════════════════════════════
    if (advancedFilters.status.length > 0) {
      result = result.filter((p) => advancedFilters.status.includes(p.status));
    }

    if (advancedFilters.stockStatus.length > 0) {
      result = result.filter((p) => {
        const stock = p.totalStock ?? 0;
        if (advancedFilters.stockStatus.includes('in_stock') && stock > 10)
          return true;
        if (
          advancedFilters.stockStatus.includes('low_stock') &&
          stock > 0 &&
          stock <= 10
        )
          return true;
        if (advancedFilters.stockStatus.includes('out_of_stock') && stock === 0)
          return true;
        return false;
      });
    }

    if (advancedFilters.isPublished === true) {
      result = result.filter((p) => p.isPublished);
    } else if (advancedFilters.isPublished === false) {
      result = result.filter((p) => !p.isPublished);
    }

    // ═══════════════════════════════════════════════════════════
    // ADVANCED FILTERS — INVENTORY / VARIANTS
    // ═══════════════════════════════════════════════════════════
    if (
      advancedFilters.stockRange[0] > 0 ||
      advancedFilters.stockRange[1] > 0
    ) {
      const [minStock, maxStock] = advancedFilters.stockRange;
      result = result.filter((p) => {
        const stock = p.totalStock ?? 0;
        if (minStock > 0 && stock < minStock) return false;
        if (maxStock > 0 && stock > maxStock) return false;
        return true;
      });
    }

    if (
      advancedFilters.variantsRange[0] > 0 ||
      advancedFilters.variantsRange[1] > 0
    ) {
      const [minVar, maxVar] = advancedFilters.variantsRange;
      result = result.filter((p) => {
        const variants = p.variantCount ?? p.subProductCount ?? 0;
        if (minVar > 0 && variants < minVar) return false;
        if (maxVar > 0 && variants > maxVar) return false;
        return true;
      });
    }

    if (advancedFilters.hasVariants === true) {
      result = result.filter(
        (p) => (p.variantCount ?? p.subProductCount ?? 0) > 0
      );
    } else if (advancedFilters.hasVariants === false) {
      result = result.filter(
        (p) => (p.variantCount ?? p.subProductCount ?? 0) === 0
      );
    }

    // ═══════════════════════════════════════════════════════════
    // ADVANCED FILTERS — BEVERAGE SPECIFIC
    // ═══════════════════════════════════════════════════════════
    if (advancedFilters.beverageTypes.length > 0) {
      result = result.filter((p) => {
        const productType = p.type?.toLowerCase() || '';
        return advancedFilters.beverageTypes.some((type) =>
          productType.includes(type.toLowerCase())
        );
      });
    }

    if (advancedFilters.isAlcoholic === true) {
      result = result.filter((p) => p.isAlcoholic);
    } else if (advancedFilters.isAlcoholic === false) {
      result = result.filter((p) => !p.isAlcoholic);
    }

    if (advancedFilters.abvRange[0] > 0 || advancedFilters.abvRange[1] > 0) {
      const [minAbv, maxAbv] = advancedFilters.abvRange;
      result = result.filter((p) => {
        const abv = p.abv || 0;
        if (minAbv > 0 && abv < minAbv) return false;
        if (maxAbv > 0 && abv > maxAbv) return false;
        return true;
      });
    }

    if (
      advancedFilters.volumeRange[0] > 0 ||
      advancedFilters.volumeRange[1] > 0
    ) {
      const [minVol, maxVol] = advancedFilters.volumeRange;
      result = result.filter((p) => {
        const volume = p.volumeMl || 0;
        if (minVol > 0 && volume < minVol) return false;
        if (maxVol > 0 && volume > maxVol) return false;
        return true;
      });
    }

    if (advancedFilters.originCountries.length > 0) {
      result = result.filter((p) => {
        const origin = p.originCountry?.toUpperCase() || '';
        return advancedFilters.originCountries.includes(origin);
      });
    }

    // ═══════════════════════════════════════════════════════════
    // ADVANCED FILTERS — DATE RANGE
    // ═══════════════════════════════════════════════════════════
    if (advancedFilters.dateRange.from) {
      const fromDate = new Date(advancedFilters.dateRange.from);
      result = result.filter((p) => new Date(p.createdAt) >= fromDate);
    }
    if (advancedFilters.dateRange.to) {
      const toDate = new Date(advancedFilters.dateRange.to);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter((p) => new Date(p.createdAt) <= toDate);
    }

    // ═══════════════════════════════════════════════════════════
    // ODOO-STYLE SP FILTERS
    // ═══════════════════════════════════════════════════════════
    if (spActiveFilters.has('published'))
      result = result.filter((p) => p.isPublished);
    if (spActiveFilters.has('low_stock'))
      result = result.filter(
        (p) => (p.totalStock ?? 0) > 0 && (p.totalStock ?? 0) <= 10
      );
    if (spActiveFilters.has('out_of_stock'))
      result = result.filter((p) => (p.totalStock ?? 0) === 0);
    if (spActiveFilters.has('alcoholic'))
      result = result.filter((p) => p.isAlcoholic);
    if (spActiveFilters.has('non_alcoholic'))
      result = result.filter((p) => !p.isAlcoholic);
    if (spActiveFilters.has('archived'))
      result = result.filter(
        (p) => p.status === 'discontinued' || p.status === 'archived'
      );

    // Custom rules
    if (activeCustomRules && activeCustomRules.rules.length > 0) {
      if (!activeCustomRules.includeArchived)
        result = result.filter(
          (p) => p.status !== 'archived' && p.status !== 'discontinued'
        );
      result = result.filter((p) => {
        const tests = activeCustomRules.rules.map((r) => applyRule(p, r));
        return activeCustomRules.matchMode === 'any'
          ? tests.some(Boolean)
          : tests.every(Boolean);
      });
    }

    return result;
  }, [
    allProducts,
    searchQuery,
    searchChips,
    statusFilter,
    visibilityFilter,
    advancedFilters,
    spActiveFilters,
    activeCustomRules,
  ]);

  // Grouped products for Odoo group-by
  const spGroupedProducts = useMemo(():
    | [string, ProductListItem[]][]
    | null => {
    if (!spGroupBy) return null;
    const map = new Map<string, ProductListItem[]>();
    filtered.forEach((p) => {
      let key: string;
      switch (spGroupBy) {
        case 'product_type':
          key = p.type?.replace(/_/g, ' ') || 'Unknown';
          break;
        case 'category':
          key = p.category?.name || 'Uncategorised';
          break;
        case 'brand':
          key = p.brand?.name || 'No brand';
          break;
        case 'status':
          key = (p.status || 'draft').replace(/_/g, ' ');
          break;
        case 'stock_level':
          key =
            (p.totalStock ?? 0) === 0
              ? 'Out of stock'
              : (p.totalStock ?? 0) <= 10
                ? 'Low stock'
                : 'In stock';
          break;
        default:
          key = 'Other';
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, spGroupBy]);

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (advancedFilters.status.length) count++;
    if (advancedFilters.stockStatus.length) count++;
    if (advancedFilters.isPublished !== null) count++;
    if (advancedFilters.stockRange[0] || advancedFilters.stockRange[1]) count++;
    if (advancedFilters.variantsRange[0] || advancedFilters.variantsRange[1])
      count++;
    if (advancedFilters.hasVariants !== null) count++;
    if (advancedFilters.beverageTypes.length) count++;
    if (advancedFilters.isAlcoholic !== null) count++;
    if (advancedFilters.abvRange[0] || advancedFilters.abvRange[1]) count++;
    if (advancedFilters.volumeRange[0] || advancedFilters.volumeRange[1])
      count++;
    if (advancedFilters.originCountries.length) count++;
    if (advancedFilters.dateRange.from || advancedFilters.dateRange.to) count++;
    return count;
  }, [advancedFilters]);

  // Handle status filter from stats cards / pills
  const handleStatusFilter = useCallback((filter: string) => {
    setStatusFilter((prev) => (prev === filter ? '' : filter));
  }, []);

  // Handle advanced filter change
  const handleAdvancedFilterChange = useCallback((newFilters: FilterConfig) => {
    setAdvancedFilters(newFilters);
  }, []);

  // Reset all filters
  const handleResetFilters = useCallback(() => {
    setAdvancedFilters(initialFilters);
    setStatusFilter('');
    setVisibilityFilter('all');
    setSearchQuery('');
    setSearchChips([]);
    setSpActiveFilters(new Set());
    setSpGroupBy(null);
    setActiveCustomRules(null);
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    fetchProducts(true);
  }, [fetchProducts]);

  // ── TanStack Table ───────────────────────────────────────────────────────────
  const { table, setData } = useTanStackTable<ProductListItem>({
    tableData: filtered,
    columnConfig: productsListColumns,
    options: {
      initialState: {
        pagination: { pageIndex: 0, pageSize: currentPageSize },
      },
      meta: {
        handleDeleteRow: async (row) => {
          if (!session?.user?.token) return;
          try {
            await productService.deleteProduct(row._id, session.user.token);
            setAllProducts((prev) => prev.filter((p) => p._id !== row._id));
            toast.success('Product deleted');
          } catch {
            toast.error('Failed to delete product');
          }
        },
        handleMultipleDelete: async (rows) => {
          if (!session?.user?.token) return;
          try {
            for (const row of rows) {
              await productService.deleteProduct(row._id, session.user.token);
            }
            const deletedIds = new Set(rows.map((r) => r._id));
            setAllProducts((prev) =>
              prev.filter((r) => !deletedIds.has(r._id))
            );
            table.resetRowSelection();
            toast.success(`Deleted ${rows.length} products`);
          } catch (err: any) {
            toast.error(err.message || 'Failed to delete');
          }
        },
      },
      enableColumnResizing: false,
    },
  });

  // Reset pagination when view mode changes
  useEffect(() => {
    table.setPagination({ pageIndex: 0, pageSize: currentPageSize });
    table.resetRowSelection();
  }, [viewMode, currentPageSize, table]);

  // Sync filtered data into the table whenever it changes (useTanStackTable only
  // initialises from the prop — it doesn't watch for updates)
  useEffect(() => {
    setData(filtered);
  }, [filtered]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedData =
    viewMode === 'list'
      ? table.getSelectedRowModel().rows.map((row) => row.original)
      : filtered.filter((p) => gridSelection[p._id]);

  // Bulk export
  const handleBulkExport = useCallback(() => {
    const dataToExport = selectedData.length > 0 ? selectedData : filtered;
    const exportFields = dataToExport.map((p) => ({
      ID: p._id,
      Name: p.name,
      Type: p.type || '',
      Category: p.category?.name || '',
      Subcategory: p.subCategory?.name || '',
      Brand: p.brand?.name || '',
      Status: p.status,
      Published: p.isPublished ? 'Yes' : 'No',
      Stock: p.totalStock ?? 0,
      Variants: p.variantCount ?? p.subProductCount ?? 0,
      Created: p.createdAt,
    }));

    exportToCSV(
      exportFields,
      'ID,Name,Type,Category,Subcategory,Brand,Status,Published,Stock,Variants,Created',
      `products_${dataToExport.length}`
    );
    toast.success(`Exported ${dataToExport.length} products`, {
      icon: <PiDownloadBold className="h-5 w-5" />,
    });
    if (viewMode === 'list') {
      table.resetRowSelection();
    } else {
      setGridSelection({});
    }
  }, [selectedData, filtered, table, viewMode]);

  // Bulk delete
  const handleBulkDelete = useCallback(async () => {
    if (selectedData.length === 0) return;
    await table.options.meta?.handleMultipleDelete?.(selectedData);
    setGridSelection({});
  }, [selectedData, table]);

  // Bulk status / publish update
  const handleBulkUpdate = useCallback(
    async (fields: Record<string, any>) => {
      if (selectedData.length === 0 || !session?.user?.token) return;
      const ids = selectedData.map((r) => r._id);
      let ok = 0;
      let failed = 0;
      for (const id of ids) {
        try {
          await productService.updateProduct(id, fields, session.user.token);
          ok++;
        } catch {
          failed++;
        }
      }
      // Patch local state so the list reflects the change without a refetch
      setAllProducts((prev) =>
        prev.map((p) => (ids.includes(p._id) ? { ...p, ...fields } : p))
      );
      if (viewMode === 'list') table.resetRowSelection();
      else setGridSelection({});
      if (failed) toast.error(`Updated ${ok}, failed ${failed}`);
      else toast.success(`Updated ${ok} product${ok !== 1 ? 's' : ''}`);
    },
    [selectedData, session?.user?.token, table, viewMode]
  );

  // Select all filtered results, across every page (Odoo pattern)
  const handleSelectAll = useCallback(() => {
    if (viewMode === 'list') {
      table.toggleAllRowsSelected(true);
    } else {
      const all: Record<string, boolean> = {};
      filtered.forEach((p) => {
        all[p._id] = true;
      });
      setGridSelection(all);
    }
  }, [viewMode, table, filtered]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleRefresh();
      }
      if (e.key === 'Escape') {
        if (viewMode === 'list') {
          table.resetRowSelection();
        } else {
          setGridSelection({});
        }
        handleResetFilters();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRefresh, handleResetFilters, table, viewMode]);

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (sessionStatus === 'loading' || isLoading)
    return viewMode === 'grid' || viewMode === 'compact' ? (
      <GridLoadingSkeleton />
    ) : (
      <LoadingSkeleton />
    );

  if (error && allProducts.length === 0)
    return <ErrorState message={error} onRetry={() => fetchProducts()} />;

  // Empty state (no data at all)
  if (allProducts.length === 0 && !isLoading) {
    return (
      <div className="space-y-5 pb-24">
        <StatsHeader
          stats={stats}
          activeFilter={statusFilter}
          onFilterChange={handleStatusFilter}
        />
        <EmptyState onClear={handleResetFilters} />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Stats Cards */}
      <StatsHeader
        stats={stats}
        activeFilter={statusFilter}
        onFilterChange={handleStatusFilter}
      />

      {/* ── Toolbar ── */}
      <div className="rounded-2xl border border-gray-200 bg-white">
        {/* Row 1: new | search | actions */}
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-3 py-2.5 sm:gap-3 sm:px-4">
          {/* ── New product button ── */}
          <button
            type="button"
            onClick={() => router.push(routes.eCommerce.createProduct)}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#b20202] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#7f1d1d]"
          >
            <PiPlus className="h-3.5 w-3.5" />
            <span>New</span>
          </button>

          {/* ── Separator ── */}
          <div className="hidden h-5 w-px shrink-0 bg-gray-200 sm:block" />

          {/* Odoo search bar — full width on mobile, capped on desktop */}
          <div
            className="relative order-last w-full min-w-0 lg:order-none lg:w-auto lg:max-w-[44rem] lg:flex-1"
            ref={searchPanelRef}
          >
            <div
              className={`flex h-9 flex-wrap items-center gap-1 rounded-lg border bg-white px-3 transition-all ${showSearchPanel || showSearchDropdown ? 'border-[#b20202] ring-2 ring-[#b20202]/10' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <PiMagnifyingGlass className="h-4 w-4 shrink-0 text-gray-400" />

              {/* Filter panel chips */}
              {Array.from(spActiveFilters)
                .filter((f) => SP_FILTER_LABELS[f])
                .map((f) => (
                  <span
                    key={f}
                    className="flex items-center gap-1 rounded-md bg-[#b20202]/10 px-2 py-0.5 text-[11px] font-semibold text-[#b20202]"
                  >
                    <PiFunnelBold className="h-2.5 w-2.5" />
                    {SP_FILTER_LABELS[f]}
                    <button
                      type="button"
                      onClick={() =>
                        setSpActiveFilters((prev) => {
                          const n = new Set(prev);
                          n.delete(f);
                          return n;
                        })
                      }
                      className="opacity-60 hover:opacity-100"
                    >
                      <PiX className="h-3 w-3" />
                    </button>
                  </span>
                ))}

              {/* Group chip */}
              {spGroupBy && (
                <span className="flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-[#b20202]">
                  {SP_GROUP_LABELS[spGroupBy]}
                  <button
                    type="button"
                    onClick={() => setSpGroupBy(null)}
                    className="opacity-60 hover:opacity-100"
                  >
                    <PiX className="h-3 w-3" />
                  </button>
                </span>
              )}

              {/* Custom rule chip */}
              {activeCustomRules && (
                <span className="flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700">
                  Custom Filter ({activeCustomRules.rules.length} rule
                  {activeCustomRules.rules.length > 1 ? 's' : ''})
                  <button
                    type="button"
                    onClick={() => setActiveCustomRules(null)}
                    className="opacity-60 hover:opacity-100"
                  >
                    <PiX className="h-3 w-3" />
                  </button>
                </span>
              )}

              {/* Search field chips */}
              {searchChips.map((chip) => (
                <span
                  key={chip.id}
                  className="flex items-center gap-0 overflow-hidden rounded-md border border-gray-200 text-[11px] font-semibold"
                >
                  <span className="bg-gray-800 px-2 py-0.5 text-white">
                    {chip.label}
                  </span>
                  <span className="bg-white px-2 py-0.5 italic text-gray-700">
                    {chip.query}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSearchChip(chip.id)}
                    className="bg-white px-1.5 py-0.5 text-gray-400 hover:text-red-500"
                  >
                    <PiX className="h-3 w-3" />
                  </button>
                </span>
              ))}

              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchDropdown(e.target.value.trim().length > 0);
                  setShowSearchPanel(false);
                }}
                onFocus={() => {
                  if (!searchQuery.trim()) setShowSearchPanel(true);
                  else setShowSearchDropdown(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    addSearchChip('product', 'Product');
                  }
                  if (
                    e.key === 'Backspace' &&
                    !searchQuery &&
                    searchChips.length > 0
                  ) {
                    removeSearchChip(searchChips[searchChips.length - 1].id);
                  }
                  if (e.key === 'Escape') {
                    setShowSearchPanel(false);
                    setShowSearchDropdown(false);
                  }
                }}
                placeholder={
                  spActiveFilters.size === 0 &&
                  !spGroupBy &&
                  searchChips.length === 0
                    ? 'Search products, brands…'
                    : 'Search…'
                }
                className="min-w-[80px] flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
              />

              {(searchQuery ||
                spActiveFilters.size > 0 ||
                spGroupBy ||
                searchChips.length > 0) && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="shrink-0 text-gray-400 transition-colors hover:text-gray-600"
                >
                  <PiX className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowSearchPanel((v) => !v);
                  setShowSearchDropdown(false);
                }}
                className={`ml-1 shrink-0 transition-colors ${showSearchPanel ? 'text-[#b20202]' : 'text-gray-400 hover:text-gray-600'}`}
              >
                {showSearchPanel ? (
                  <PiCaretUp className="h-3.5 w-3.5" />
                ) : (
                  <PiCaretDown className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            {/* Typing suggestions dropdown */}
            {showSearchDropdown && searchQuery.trim() && (
              <div className="ring-black/8 absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl bg-white shadow-xl ring-1">
                {SP_CHIP_FIELDS.map((cf, i) => (
                  <button
                    key={cf.field}
                    type="button"
                    onClick={() => addSearchChip(cf.field, cf.label)}
                    className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-50 ${i === 0 ? 'bg-gray-50' : ''}`}
                  >
                    {i === 0 ? (
                      <PiCaretRight className="h-3 w-3 text-gray-400" />
                    ) : (
                      <span className="w-3" />
                    )}
                    <span>
                      Search <strong>{cf.label}</strong> for:{' '}
                      <em className="text-[#b20202]">{searchQuery.trim()}</em>
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setShowSearchDropdown(false);
                    setShowCustomFilterModal(true);
                  }}
                  className="flex w-full items-center gap-2 border-t border-gray-100 bg-gray-50 px-4 py-2.5 text-sm font-medium text-[#b20202] transition-colors hover:bg-red-50"
                >
                  Add Custom Filter
                </button>
              </div>
            )}

            {/* Filters / Group By / Favorites panel */}
            {showSearchPanel && (
              <OdooSearchPanel
                activeFilters={spActiveFilters}
                groupBy={spGroupBy}
                savedSearches={spSavedSearches}
                onToggleFilter={(f) =>
                  setSpActiveFilters((prev) => {
                    const n = new Set(prev);
                    n.has(f) ? n.delete(f) : n.add(f);
                    return n;
                  })
                }
                onSetGroupBy={(g) => setSpGroupBy(g)}
                onSave={(name) => {
                  const entry: SPSavedSearch = {
                    id: Date.now().toString(),
                    name,
                    query: searchQuery,
                    filters: Array.from(spActiveFilters),
                    groupBy: spGroupBy,
                    chips: searchChips,
                  };
                  const updated = [...spSavedSearches, entry];
                  setSpSavedSearches(updated);
                  spPersistSaved(updated);
                }}
                onLoadSaved={(s) => {
                  setSearchQuery(s.query);
                  setSpActiveFilters(new Set(s.filters));
                  setSpGroupBy(s.groupBy);
                  setSearchChips(s.chips || []);
                  setShowSearchPanel(false);
                }}
                onDeleteSaved={(id) => {
                  const updated = spSavedSearches.filter((s) => s.id !== id);
                  setSpSavedSearches(updated);
                  spPersistSaved(updated);
                }}
                onClose={() => setShowSearchPanel(false)}
                advancedFilters={advancedFilters}
                onAdvancedFilterChange={handleAdvancedFilterChange}
                onReset={handleResetFilters}
                activeFilterCount={activeFilterCount}
                onAddCustomFilter={() => {
                  setShowSearchPanel(false);
                  setShowCustomFilterModal(true);
                }}
              />
            )}
          </div>

          {/* ── Right controls — pushed to end ── */}
          <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
            {/* Visibility */}
            <select
              value={visibilityFilter}
              onChange={(e) => setVisibilityFilter(e.target.value as any)}
              className="h-9 cursor-pointer rounded-lg border border-gray-200 bg-white px-2.5 text-sm text-gray-600 outline-none transition-colors hover:border-gray-300 focus:border-gray-400"
            >
              <option value="all">All visibility</option>
              <option value="published">
                Published ({stats.publishedFlag || 0})
              </option>
              <option value="draft">Draft ({stats.draftFlag || 0})</option>
            </select>

            {/* Separator */}
            <div className="h-5 w-px bg-gray-200" />

            {/* Column toggle (list only) */}
            {viewMode === 'list' && <ColumnToggle table={table} />}

            {/* View toggle */}
            <ViewToggle
              currentView={viewMode}
              onViewChange={handleViewModeChange}
            />

            {/* Separator */}
            <div className="h-5 w-px bg-gray-200" />

            {/* Refresh */}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40"
            >
              <PiArrowsClockwiseBold
                className={cn('h-4 w-4', isRefreshing && 'animate-spin')}
              />
            </button>
          </div>
        </div>

        {/* Row 2: status filter pills + result count */}
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
          {[
            { id: '', label: 'All', count: stats.total },
            { id: 'published', label: 'Published', count: stats.published },
            { id: 'draft', label: 'Draft', count: stats.draft },
            { id: 'low_stock', label: 'Low Stock', count: stats.lowStock },
            {
              id: 'out_of_stock',
              label: 'Out of Stock',
              count: stats.outOfStock,
            },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => handleStatusFilter(f.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all',
                statusFilter === f.id
                  ? 'bg-[#b20202] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {f.label}
              <span
                className={cn(
                  'rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums',
                  statusFilter === f.id
                    ? 'bg-white/20'
                    : 'bg-white text-gray-500'
                )}
              >
                {f.count}
              </span>
            </button>
          ))}

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="ml-1 flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-2.5 py-1 text-[11px] text-gray-500 transition-colors hover:border-red-300 hover:text-red-500"
            >
              <PiXCircleBold className="h-3 w-3" />
              {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}{' '}
              active
            </button>
          )}

          <span className="ml-auto text-xs text-gray-400">
            {filtered.length} of {allProducts.length} products
          </span>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectedData.length > 0 && (
          <BulkActionsBar
            selectedCount={selectedData.length}
            totalCount={filtered.length}
            onSelectAll={handleSelectAll}
            onDelete={handleBulkDelete}
            onExport={handleBulkExport}
            onArchive={() => handleBulkUpdate({ status: 'archived' })}
            onUnarchive={() => handleBulkUpdate({ status: 'draft' })}
            onSetStatus={(s) => handleBulkUpdate({ status: s })}
            onSetPublished={(v) => handleBulkUpdate({ isPublished: v })}
            onClear={() => {
              if (viewMode === 'list') {
                table.resetRowSelection();
              } else {
                setGridSelection({});
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Empty filtered results */}
      {filtered.length === 0 && allProducts.length > 0 ? (
        <EmptyState query={searchQuery} onClear={handleResetFilters} />
      ) : viewMode === 'grid' || viewMode === 'compact' ? (
        /* Grid / Compact View */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm sm:rounded-2xl"
        >
          {spGroupedProducts ? (
            /* Grouped view */
            <div className="space-y-6 p-3 sm:p-6">
              {spGroupedProducts.map(([groupName, groupItems]) => (
                <div key={groupName}>
                  <div className="mb-3 flex items-center gap-2">
                    <PiStack className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-bold capitalize text-gray-700">
                      {groupName}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
                      {groupItems.length}
                    </span>
                  </div>
                  <div
                    className={cn(
                      'grid gap-3 sm:gap-4',
                      viewMode === 'grid'
                        ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                        : 'grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                    )}
                  >
                    {groupItems.map((product, index) => (
                      <motion.div
                        key={product._id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                      >
                        {viewMode === 'grid' ? (
                          <ProductGridCard
                            product={product}
                            isSelected={!!gridSelection[product._id]}
                            onSelect={() =>
                              setGridSelection((prev) => ({
                                ...prev,
                                [product._id]: !prev[product._id],
                              }))
                            }
                          />
                        ) : (
                          <ProductGridCardCompact
                            product={product}
                            isSelected={!!gridSelection[product._id]}
                            onSelect={() =>
                              setGridSelection((prev) => ({
                                ...prev,
                                [product._id]: !prev[product._id],
                              }))
                            }
                          />
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div
                className={cn(
                  'grid gap-3 p-3 sm:gap-4 sm:p-6',
                  viewMode === 'grid'
                    ? 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
                    : 'grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
                )}
              >
                {filtered
                  .slice(
                    table.getState().pagination.pageIndex *
                      table.getState().pagination.pageSize,
                    (table.getState().pagination.pageIndex + 1) *
                      table.getState().pagination.pageSize
                  )
                  .map((product, index) => (
                    <motion.div
                      key={product._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                    >
                      {viewMode === 'grid' ? (
                        <ProductGridCard
                          product={product}
                          isSelected={!!gridSelection[product._id]}
                          onSelect={() =>
                            setGridSelection((prev) => ({
                              ...prev,
                              [product._id]: !prev[product._id],
                            }))
                          }
                        />
                      ) : (
                        <ProductGridCardCompact
                          product={product}
                          isSelected={!!gridSelection[product._id]}
                          onSelect={() =>
                            setGridSelection((prev) => ({
                              ...prev,
                              [product._id]: !prev[product._id],
                            }))
                          }
                        />
                      )}
                    </motion.div>
                  ))}
              </div>
              {!hidePagination && (
                <TablePagination
                  table={table}
                  className={cn(
                    'border-t border-gray-100 bg-gray-50/50 p-4',
                    paginationClassName
                  )}
                />
              )}
            </>
          )}
        </motion.div>
      ) : (
        /* List View */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm"
        >
          {spGroupedProducts ? (
            /* Grouped list view — compact rows per group */
            <div className="space-y-6 p-3 sm:p-6">
              {spGroupedProducts.map(([groupName, groupItems]) => (
                <div key={groupName}>
                  <div className="mb-3 flex items-center gap-2">
                    <PiStack className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-bold capitalize text-gray-700">
                      {groupName}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
                      {groupItems.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {groupItems.map((product) => (
                      <ProductGridCardCompact
                        key={product._id}
                        product={product}
                        isSelected={!!gridSelection[product._id]}
                        onSelect={() =>
                          setGridSelection((prev) => ({
                            ...prev,
                            [product._id]: !prev[product._id],
                          }))
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <Table
                table={table}
                variant="modern"
                classNames={{
                  container: 'rounded-none border-0',
                  ...classNames,
                }}
              />
              {!hideFooter && (
                <TableFooter table={table} onExport={handleBulkExport} />
              )}
              {!hidePagination && (
                <TablePagination
                  table={table}
                  className={cn(
                    'border-t border-gray-100 bg-gray-50/50 p-4',
                    paginationClassName
                  )}
                />
              )}
            </>
          )}
        </motion.div>
      )}

      {/* Custom Filter Modal */}
      {showCustomFilterModal && (
        <CustomFilterModal
          onAdd={(rules, matchMode, includeArchived) => {
            setActiveCustomRules({ rules, matchMode, includeArchived });
            setShowCustomFilterModal(false);
          }}
          onCancel={() => setShowCustomFilterModal(false)}
        />
      )}
    </div>
  );
}

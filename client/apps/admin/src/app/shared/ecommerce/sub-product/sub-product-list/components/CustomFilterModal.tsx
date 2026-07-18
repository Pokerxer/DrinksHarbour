// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import {
  PiFunnel,
  PiX,
  PiCaretDown,
  PiCaretUp,
  PiMagnifyingGlass,
  PiPlus,
  PiTrash,
} from 'react-icons/pi';

// ── Custom filter rule types ────────────────────────────────────────────────────
export type RuleOperator =
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
export type FieldType = 'text' | 'number' | 'boolean' | 'date' | 'select';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
}

export interface CustomRule {
  id: string;
  fieldKey: string;
  operator: RuleOperator;
  value: string;
}

export const CUSTOM_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Product Name', type: 'text' },
  { key: 'sku', label: 'SKU', type: 'text' },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'draft', label: 'Draft' },
      { value: 'pending', label: 'Pending' },
      { value: 'discontinued', label: 'Discontinued' },
      { value: 'archived', label: 'Archived' },
      { value: 'hidden', label: 'Hidden' },
    ],
  },
  {
    key: 'stockStatus',
    label: 'Stock Status',
    type: 'select',
    options: [
      { value: 'in_stock', label: 'In Stock' },
      { value: 'low_stock', label: 'Low Stock' },
      { value: 'out_of_stock', label: 'Out of Stock' },
      { value: 'pre_order', label: 'Pre-Order' },
    ],
  },
  { key: 'totalStock', label: 'Total Stock', type: 'number' },
  { key: 'availableStock', label: 'Available Stock', type: 'number' },
  { key: 'baseSellingPrice', label: 'Selling Price', type: 'number' },
  { key: 'costPrice', label: 'Cost Price', type: 'number' },
  { key: 'marginPercentage', label: 'Margin %', type: 'number' },
  { key: 'totalSold', label: 'Total Sold', type: 'number' },
  { key: 'totalRevenue', label: 'Total Revenue', type: 'number' },
  { key: 'viewCount', label: 'View Count', type: 'number' },
  { key: 'isPublished', label: 'Published', type: 'boolean' },
  { key: 'isFeaturedByTenant', label: 'Featured', type: 'boolean' },
  { key: 'isBestSeller', label: 'Best Seller', type: 'boolean' },
  { key: 'isNewArrival', label: 'New Arrival', type: 'boolean' },
  { key: 'isOnSale', label: 'On Sale', type: 'boolean' },
  { key: 'visibleInPOS', label: 'Visible in POS', type: 'boolean' },
  { key: 'visibleInOnlineStore', label: 'Visible in Store', type: 'boolean' },
  { key: 'productType', label: 'Product Type', type: 'text' },
  { key: 'category', label: 'Category', type: 'text' },
  { key: 'brand', label: 'Brand / Vendor', type: 'text' },
  { key: 'originCountry', label: 'Origin Country', type: 'text' },
  { key: 'isAlcoholic', label: 'Alcoholic', type: 'boolean' },
  { key: 'abv', label: 'ABV (%)', type: 'number' },
  { key: 'volumeMl', label: 'Volume (ml)', type: 'number' },
  { key: 'lowStockThreshold', label: 'Low Stock Threshold', type: 'number' },
  { key: 'reorderPoint', label: 'Reorder Point', type: 'number' },
  { key: 'createdAt', label: 'Date Added', type: 'date' },
  { key: 'lastSoldDate', label: 'Last Sold Date', type: 'date' },
  { key: 'lastRestockDate', label: 'Last Restock Date', type: 'date' },
];

export function getOperatorsForType(
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

export function getRuleValue(product: any, fieldKey: string): any {
  switch (fieldKey) {
    case 'name':
      return product.product?.name || '';
    case 'sku':
      return product.sku || '';
    case 'status':
      return product.status || '';
    case 'stockStatus':
      return product.stockStatus || '';
    case 'totalStock':
      return product.totalStock ?? 0;
    case 'availableStock':
      return product.availableStock ?? 0;
    case 'baseSellingPrice':
      return product.baseSellingPrice ?? 0;
    case 'costPrice':
      return product.costPrice ?? 0;
    case 'marginPercentage':
      return product.marginPercentage ?? 0;
    case 'totalSold':
      return product.totalSold ?? 0;
    case 'totalRevenue':
      return product.totalRevenue ?? 0;
    case 'viewCount':
      return product.viewCount ?? 0;
    case 'isPublished':
      return product.isPublished ? 'true' : 'false';
    case 'isFeaturedByTenant':
      return product.isFeaturedByTenant ? 'true' : 'false';
    case 'isBestSeller':
      return product.isBestSeller ? 'true' : 'false';
    case 'isNewArrival':
      return product.isNewArrival ? 'true' : 'false';
    case 'isOnSale':
      return product.isOnSale ? 'true' : 'false';
    case 'visibleInPOS':
      return product.visibleInPOS !== false ? 'true' : 'false';
    case 'visibleInOnlineStore':
      return product.visibleInOnlineStore !== false ? 'true' : 'false';
    case 'productType':
      return product.product?.type || '';
    case 'category':
      return product.product?.category?.name || '';
    case 'brand':
      return product.product?.brand?.name || '';
    case 'originCountry':
      return product.product?.originCountry || '';
    case 'isAlcoholic':
      return product.product?.isAlcoholic ? 'true' : 'false';
    case 'abv':
      return product.product?.abv ?? 0;
    case 'volumeMl':
      return product.product?.volumeMl ?? 0;
    case 'lowStockThreshold':
      return product.lowStockThreshold ?? 0;
    case 'reorderPoint':
      return product.reorderPoint ?? 0;
    case 'createdAt':
      return product.createdAt || '';
    case 'lastSoldDate':
      return product.lastSoldDate || '';
    case 'lastRestockDate':
      return product.lastRestockDate || '';
    default:
      return '';
  }
}

export function applyRule(product: any, rule: CustomRule): boolean {
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

export interface ActiveCustomRules {
  rules: CustomRule[];
  matchMode: 'any' | 'all';
  includeArchived: boolean;
}

export default function CustomFilterModal({
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
              <div key={rule.id} className="group flex flex-wrap items-center gap-2 sm:flex-nowrap">
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
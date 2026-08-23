'use client';

import { motion } from 'framer-motion';
import {
  PiMagnifyingGlassBold,
  PiArrowsClockwiseBold,
  PiFunnelBold,
  PiArrowLineUpBold,
} from 'react-icons/pi';
import {
  STATUS_CONFIG,
  PAY_CONFIG,
  METHOD_CONFIG,
  SOURCE_CONFIG,
} from './order-meta';

export interface TableToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  paymentFilter: string;
  onPaymentFilterChange: (v: string) => void;
  methodFilter: string;
  onMethodFilterChange: (v: string) => void;
  sourceFilter: string;
  onSourceFilterChange: (v: string) => void;
  fromDate: string;
  onFromDateChange: (v: string) => void;
  toDate: string;
  onToDateChange: (v: string) => void;
  totalOrders: number;
  hasFilters: boolean;
  onClearFilters: () => void;
  refreshing: boolean;
  onRefresh: () => void;
  exporting: boolean;
  busy: boolean;
  onExport: () => void;
}

const selectClass =
  'rounded-xl border border-muted bg-gray-50 px-3 py-2.5 text-sm text-gray-900 transition-all focus:border-primary focus:bg-gray-0 focus:outline-none';

export default function TableToolbar(props: TableToolbarProps) {
  const {
    search,
    onSearchChange,
    statusFilter,
    onStatusFilterChange,
    paymentFilter,
    onPaymentFilterChange,
    methodFilter,
    onMethodFilterChange,
    sourceFilter,
    onSourceFilterChange,
    fromDate,
    onFromDateChange,
    toDate,
    onToDateChange,
    totalOrders,
    hasFilters,
    onClearFilters,
    refreshing,
    onRefresh,
    exporting,
    busy,
    onExport,
  } = props;

  const chips = [
    search && { label: `"${search}"`, clear: () => onSearchChange('') },
    statusFilter && {
      label: STATUS_CONFIG[statusFilter]?.label ?? statusFilter,
      clear: () => onStatusFilterChange(''),
    },
    paymentFilter && {
      label: PAY_CONFIG[paymentFilter]?.label ?? paymentFilter,
      clear: () => onPaymentFilterChange(''),
    },
    methodFilter && {
      label: METHOD_CONFIG[methodFilter]?.label ?? methodFilter,
      clear: () => onMethodFilterChange(''),
    },
    sourceFilter && {
      label: SOURCE_CONFIG[sourceFilter]?.label ?? sourceFilter,
      clear: () => onSourceFilterChange(''),
    },
    fromDate && { label: `From ${fromDate}`, clear: () => onFromDateChange('') },
    toDate && { label: `To ${toDate}`, clear: () => onToDateChange('') },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  return (
    <div className="mb-4 rounded-2xl border border-muted bg-gray-0 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <PiMagnifyingGlassBold className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search order #, receipt, customer, email, phone…"
            aria-label="Search orders"
            className="w-full rounded-xl border border-muted bg-gray-50 py-2.5 pe-4 ps-9 text-sm text-gray-900 transition-all focus:border-primary focus:bg-gray-0 focus:outline-none"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          aria-label="Filter by order status"
          className={selectClass}
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>

        <select
          value={paymentFilter}
          onChange={(e) => onPaymentFilterChange(e.target.value)}
          aria-label="Filter by payment status"
          className={selectClass}
        >
          <option value="">All payments</option>
          {Object.entries(PAY_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>

        <select
          value={methodFilter}
          onChange={(e) => onMethodFilterChange(e.target.value)}
          aria-label="Filter by payment method"
          className={selectClass}
        >
          <option value="">All methods</option>
          {Object.entries(METHOD_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>

        <select
          value={sourceFilter}
          onChange={(e) => onSourceFilterChange(e.target.value)}
          aria-label="Filter by order source"
          className={selectClass}
        >
          <option value="">All sources</option>
          {Object.entries(SOURCE_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => onFromDateChange(e.target.value)}
            aria-label="Orders placed from"
            className={selectClass}
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => onToDateChange(e.target.value)}
            aria-label="Orders placed until"
            className={selectClass}
          />
        </div>

        <span className="whitespace-nowrap text-sm text-gray-500">
          {totalOrders} order{totalOrders === 1 ? '' : 's'}
        </span>

        <motion.button
          type="button"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={onRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-xl border border-muted px-3 py-2.5 text-sm font-medium text-gray-700 transition-all hover:border-primary hover:text-gray-900 disabled:opacity-60"
        >
          <motion.span
            animate={refreshing ? { rotate: 360 } : {}}
            transition={{
              duration: 0.8,
              repeat: refreshing ? Infinity : 0,
              ease: 'linear',
            }}
            className="inline-flex"
          >
            <PiArrowsClockwiseBold className="h-4 w-4" />
          </motion.span>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </motion.button>

        <motion.button
          type="button"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={onExport}
          disabled={exporting || busy}
          className="flex items-center gap-2 rounded-xl border border-muted px-3 py-2.5 text-sm font-medium text-gray-700 transition-all hover:border-primary hover:text-gray-900 disabled:opacity-60"
        >
          <PiArrowLineUpBold className="h-4 w-4" />
          {exporting ? 'Exporting…' : 'Export'}
        </motion.button>
      </div>

      {hasFilters && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-muted pt-3">
          <PiFunnelBold className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-gray-700">Filters:</span>
          {chips.map((f, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
            >
              {f.label}
              <button
                type="button"
                onClick={f.clear}
                aria-label={`Remove filter ${f.label}`}
                className="font-bold hover:text-red-500"
              >
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={onClearFilters}
            className="ms-auto text-xs font-medium text-red-500 hover:text-red-600"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

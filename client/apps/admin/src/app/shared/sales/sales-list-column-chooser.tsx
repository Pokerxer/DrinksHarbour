'use client';

import { useState } from 'react';
import { PiCheck, PiX } from 'react-icons/pi';
import { salesOrderService } from '@/services/salesOrder.service';
import toast from 'react-hot-toast';
import type { OptionalCol } from './sales-list-helpers';

interface Props {
  open: boolean;
  cols: OptionalCol[];
  onToggle: (key: string) => void;
  token: string;
}

export const OPTIONAL_COLS: OptionalCol[] = [
  { key: 'creationDate', label: 'Creation Date', visible: true },
  { key: 'deliveryDate', label: 'Delivery Date', visible: false },
  { key: 'expectedDate', label: 'Expected Date', visible: false },
  { key: 'website', label: 'Website', visible: false },
  { key: 'activities', label: 'Activities', visible: true },
  { key: 'salesTeam', label: 'Sales Team', visible: false },
  { key: 'untaxedAmount', label: 'Untaxed Amount', visible: false },
  { key: 'tasks', label: 'Tasks', visible: false },
  { key: 'total', label: 'Total', visible: true },
  { key: 'tags', label: 'Tags', visible: false },
  { key: 'warehouse', label: 'Warehouse', visible: true },
  { key: 'invoiceStatus', label: 'Invoice Status', visible: false },
  { key: 'customerRef', label: 'Customer Reference', visible: false },
  { key: 'expiration', label: 'Expiration', visible: false },
];

export default function SalesListColumnChooser({ open, cols, onToggle, token }: Props) {
  const [customFormOpen, setCustomFormOpen] = useState(false);
  const [fieldName, setFieldName] = useState('');
  const [fieldType, setFieldType] = useState('text');
  const [options, setOptions] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function handleCreateField() {
    if (!fieldName.trim()) return;
    setSubmitting(true);
    try {
      const body: { fieldName: string; fieldType: string; options?: string[] } = {
        fieldName: fieldName.trim(),
        fieldType,
      };
      if (fieldType === 'select' && options.trim()) {
        body.options = options.split(',').map((s) => s.trim());
      }
      await salesOrderService.createCustomField(body, token);
      toast.success(`Custom field "${fieldName}" created`);
      setCustomFormOpen(false);
      setFieldName('');
      setFieldType('text');
      setOptions('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create field');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-xl border border-gray-100 bg-white py-2 shadow-xl"
      role="dialog"
      aria-label="Column visibility"
    >
      <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
        Optional Columns
      </p>
      {cols.map((col) => (
        <button
          key={col.key}
          type="button"
          onClick={() => onToggle(col.key)}
          className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          aria-pressed={col.visible}
        >
          <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
              col.visible
                ? 'border-brand bg-brand'
                : 'border-gray-300 bg-white'
            }`}
          >
            {col.visible && <PiCheck className="h-3 w-3 text-white" />}
          </span>
          {col.label}
        </button>
      ))}
      <div className="mt-1 border-t border-gray-100 pt-1">
        {customFormOpen ? (
          <div className="space-y-2 px-3 py-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">New Custom Field</span>
              <button type="button" onClick={() => setCustomFormOpen(false)} className="text-gray-400 hover:text-gray-600">
                <PiX className="h-3.5 w-3.5" />
              </button>
            </div>
            <input
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              placeholder="Field name"
              className="w-full rounded border border-gray-200 px-2 py-1 text-xs outline-none focus:border-brand"
            />
            <select
              value={fieldType}
              onChange={(e) => setFieldType(e.target.value)}
              className="w-full rounded border border-gray-200 px-2 py-1 text-xs outline-none focus:border-brand"
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="select">Select</option>
              <option value="boolean">Boolean</option>
            </select>
            {fieldType === 'select' && (
              <input
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                placeholder="Options (comma-separated)"
                className="w-full rounded border border-gray-200 px-2 py-1 text-xs outline-none focus:border-brand"
              />
            )}
            <button
              type="button"
              onClick={handleCreateField}
              disabled={submitting || !fieldName.trim()}
              className="w-full rounded bg-brand px-2 py-1 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCustomFormOpen(true)}
            className="px-3 py-1.5 text-xs text-brand hover:underline"
          >
            Add Custom Field
          </button>
        )}
      </div>
    </div>
  );
}

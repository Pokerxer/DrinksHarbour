'use client';

// app/shared/warehouses/warehouse-detail/export-menu.tsx
// CSV / Excel / PDF dropdown. Closes on Escape as well as outside click; the
// document building itself lives in ./export-helpers.

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  PiCaretDownBold,
  PiDownloadSimpleBold,
  PiFileCsvBold,
  PiFileXlsBold,
  PiFilePdfBold,
} from 'react-icons/pi';
import type { Warehouse } from '@/services/warehouse.service';
import type { WarehouseStockRow } from '@/services/warehouseStock.service';
import {
  buildExport,
  type ExportColumn,
  type ExportFormat,
  type ExportTotals,
} from './export-helpers';

const FORMATS: {
  fmt: ExportFormat;
  label: string;
  ext: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { fmt: 'csv', label: 'CSV', ext: '.csv', icon: PiFileCsvBold },
  { fmt: 'excel', label: 'Excel', ext: '.xlsx', icon: PiFileXlsBold },
  { fmt: 'pdf', label: 'PDF', ext: '.pdf', icon: PiFilePdfBold },
];

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ExportMenu({
  rows,
  warehouse,
  warehouseId,
  filter,
  search,
  columns,
  totals,
}: {
  rows: WarehouseStockRow[];
  warehouse: Warehouse | null;
  warehouseId: string;
  filter: string;
  search: string;
  columns: ExportColumn[];
  totals: ExportTotals;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const runExport = (fmt: ExportFormat) => {
    setOpen(false);
    try {
      const { blob, filename } = buildExport({
        format: fmt,
        rows,
        warehouse,
        warehouseId,
        filter,
        search,
        columns,
        totals,
      });
      if (blob) downloadBlob(blob, filename);
      toast.success(`Exported ${rows.length} lines`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={rows.length === 0}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <PiDownloadSimpleBold className="h-4 w-4" />
        Export
        <PiCaretDownBold
          className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-[#ece4d6] bg-white py-1 shadow-lg"
        >
          {FORMATS.map(({ fmt, label, ext, icon: Icon }) => (
            <button
              key={fmt}
              type="button"
              role="menuitem"
              onClick={() => runExport(fmt)}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-[#b20202]/5 hover:text-[#b20202]"
            >
              <Icon className="h-4 w-4 text-[#b20202]" />
              <span className="font-medium">{label}</span>
              <span className="ml-auto font-mono text-xs text-gray-400">
                {ext}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

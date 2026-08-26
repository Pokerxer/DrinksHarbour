'use client';

import { PiPrinter } from 'react-icons/pi';
import type { ReactNode } from 'react';

/** Print + Export button row shared by every report table. */
export default function ReportActions({
  onPrint,
  onExport,
  extra,
}: {
  onPrint: () => void;
  onExport: () => void;
  extra?: ReactNode;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
      {extra}
      <button
        type="button"
        onClick={onPrint}
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        <PiPrinter size={14} /> Print
      </button>
      <button
        type="button"
        onClick={onExport}
        className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-black"
      >
        Export CSV
      </button>
    </div>
  );
}

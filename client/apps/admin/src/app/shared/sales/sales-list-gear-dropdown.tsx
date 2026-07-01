'use client';

import type { FC } from 'react';
import {
  PiCaretRight,
  PiDownloadSimple,
  PiFileCsv,
  PiFileText,
  PiTable,
  PiUploadSimple,
} from 'react-icons/pi';

interface MenuItem {
  icon: FC<{ className?: string }>;
  label: string;
  onClick: () => void;
  hasArrow?: boolean;
}

interface Props {
  open: boolean;
  onImport: () => void;
  onExport: () => void;
  onKnowledge: () => void;
  onSpreadsheet: () => void;
  onClose: () => void;
}

export default function SalesListGearDropdown({
  open,
  onImport,
  onExport,
  onKnowledge,
  onSpreadsheet,
  onClose,
}: Props) {
  if (!open) return null;

  const items: MenuItem[] = [
    { icon: PiUploadSimple, label: 'Upload Request For Quotation', onClick: onImport },
    { icon: PiFileCsv, label: 'Import records', onClick: onImport },
    { icon: PiDownloadSimple, label: 'Export All', onClick: onExport },
  ];

  const secondary: MenuItem[] = [
    { icon: PiFileText, label: 'Knowledge', onClick: onKnowledge },
    { icon: PiTable, label: 'Spreadsheet', onClick: onSpreadsheet },
  ];

  return (
    <div className="absolute left-0 top-full z-50 mt-1 w-60 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-xl">
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          onClick={() => { item.onClick(); onClose(); }}
          className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50"
          aria-label={item.label}
        >
          <item.icon className="h-4 w-4 shrink-0 text-gray-400" />
          <span className="flex-1 text-left">{item.label}</span>
        </button>
      ))}
      <div className="my-1 border-t border-gray-100" />
      {secondary.map((item, i) => (
        <button
          key={i}
          type="button"
          onClick={() => { item.onClick(); }}
          className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50"
          aria-label={item.label}
        >
          <item.icon className="h-4 w-4 shrink-0 text-gray-400" />
          <span className="flex-1 text-left">{item.label}</span>
          <PiCaretRight className="h-3.5 w-3.5 text-gray-400" />
        </button>
      ))}
    </div>
  );
}

'use client';

import {
  PiFileCsv,
  PiFileXls,
  PiFilePdf,
  PiX,
  PiDownloadSimple,
} from 'react-icons/pi';
import { LINE_EXPORT_COLS, GROUP_EXPORT_COLS } from '../constants';
import type { LineExportCol, GroupExportCol } from '../types';

export function ExportColumnModal({
  format,
  isGrouped,
  hasCost,
  lineCols,
  groupCols,
  onToggleLine,
  onToggleGroup,
  onSelectAll,
  onDeselectAll,
  onCancel,
  onDownload,
}: {
  format: 'csv' | 'excel' | 'pdf';
  isGrouped: boolean;
  hasCost: boolean;
  lineCols: Set<LineExportCol>;
  groupCols: Set<GroupExportCol>;
  onToggleLine: (k: LineExportCol) => void;
  onToggleGroup: (k: GroupExportCol) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onCancel: () => void;
  onDownload: () => void;
}) {
  const visible = isGrouped
    ? GROUP_EXPORT_COLS.filter((c) => hasCost || !c.costOnly)
    : LINE_EXPORT_COLS.filter((c) => hasCost || !c.costOnly);
  const selected = isGrouped ? groupCols : lineCols;
  const toggle = isGrouped
    ? (k: string) => onToggleGroup(k as GroupExportCol)
    : (k: string) => onToggleLine(k as LineExportCol);

  const selCount = visible.filter((c) =>
    selected.has(c.key as LineExportCol & GroupExportCol)
  ).length;
  const reqCount = visible.filter((c) => c.required).length;

  const FmtIcon =
    format === 'csv' ? PiFileCsv : format === 'excel' ? PiFileXls : PiFilePdf;
  const fmtLabel =
    format === 'csv' ? 'CSV' : format === 'excel' ? 'Excel' : 'PDF';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
      <div className="flex max-h-[90vh] w-[540px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10">
        <div className="flex shrink-0 items-center gap-3 border-b border-gray-100 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#b20202]/10">
            <FmtIcon className="h-5 w-5 text-[#b20202]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900">
              Export as {fmtLabel}
            </p>
            <p className="text-xs text-gray-400">
              Choose the columns to include
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <PiX className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-4">
          <div className="grid grid-cols-3 gap-1.5">
            {visible.map((col) => {
              const checked = selected.has(
                col.key as LineExportCol & GroupExportCol
              );
              const disabled = !!col.required;
              return (
                <button
                  key={col.key}
                  type="button"
                  onClick={() => !disabled && toggle(col.key)}
                  disabled={disabled}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-2.5 text-left text-xs transition-colors ${
                    checked
                      ? disabled
                        ? 'cursor-default border-gray-200 bg-gray-50 text-gray-500'
                        : 'border-[#b20202]/30 bg-red-50 text-[#b20202]'
                      : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <span
                    className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border text-[9px] font-bold transition-all ${
                      checked
                        ? disabled
                          ? 'border-gray-300 bg-gray-300 text-white'
                          : 'border-[#b20202] bg-[#b20202] text-white'
                        : 'border-gray-300'
                    }`}
                  >
                    {checked ? '✓' : ''}
                  </span>
                  <span className="flex-1 font-medium leading-tight">
                    {col.label}
                  </span>
                  {disabled && (
                    <span className="text-[9px] text-gray-300">req</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-3">
            <p className="text-xs text-gray-400">
              {selCount} of {visible.length} selected
              {reqCount > 0 ? ` (${reqCount} required)` : ''}
            </p>
            <button
              type="button"
              onClick={onSelectAll}
              className="text-xs font-medium text-[#b20202] hover:underline"
            >
              Select all
            </button>
            <span className="select-none text-gray-200">·</span>
            <button
              type="button"
              onClick={onDeselectAll}
              disabled={selCount <= reqCount}
              className="text-xs font-medium text-gray-400 hover:text-gray-600 hover:underline disabled:opacity-40"
            >
              Deselect all
            </button>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDownload}
            disabled={selCount === 0}
            className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#9a0101] disabled:opacity-50"
          >
            <PiDownloadSimple className="h-4 w-4" />
            Download {fmtLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
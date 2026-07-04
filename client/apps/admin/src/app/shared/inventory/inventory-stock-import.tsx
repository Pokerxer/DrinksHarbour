'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { PiUploadSimple, PiX, PiDownloadSimple, PiCheckCircle, PiWarningCircle } from 'react-icons/pi';
import {
  subProductImportService, buildTemplateCsv, IMPORT_COLUMNS,
  type ImportRow, type PreviewResult, type CommitResult,
} from '@/services/subProductImport.service';

type Warehouse = { id: string; name: string };

function downloadTemplate() {
  const blob = new Blob([buildTemplateCsv()], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'subproduct-import-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// Parse a File (.csv or .xlsx) into row objects keyed by IMPORT_COLUMNS headers.
async function parseFile(file: File): Promise<ImportRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  return raw.map((r) => {
    const row: ImportRow = {};
    for (const col of IMPORT_COLUMNS) {
      // tolerate header case / spacing differences
      const key = Object.keys(r).find((k) => k.trim().toLowerCase() === col.toLowerCase());
      row[col] = key ? (r[key] as string | number) : '';
    }
    return row;
  });
}

export default function InventoryStockImport({
  open, token, warehouses, onClose, onDone,
}: {
  open: boolean;
  token: string;
  warehouses: Warehouse[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = useCallback(() => {
    setRows([]); setFileName(''); setPreview(null); setBusy(false);
  }, []);

  const onDrop = useCallback(async (accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    try {
      const parsed = await parseFile(file);
      if (parsed.length === 0) { toast.error('No rows found in file'); return; }
      setRows(parsed); setFileName(file.name); setPreview(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to parse file');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    multiple: false,
  });

  const runPreview = useCallback(async () => {
    setBusy(true);
    try {
      const res = await subProductImportService.preview(rows, warehouseId || null, token);
      setPreview(res.data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Preview failed');
    } finally { setBusy(false); }
  }, [rows, warehouseId, token]);

  const runCommit = useCallback(async () => {
    setBusy(true);
    try {
      const res = await subProductImportService.commit(rows, warehouseId || null, token);
      const d: CommitResult = res.data;
      toast.success(`Imported ${d.createdSubProducts} products · ${d.createdSizes} sizes · ${d.stockApplied} stock lines`);
      if (d.errors.length) toast.error(`${d.errors.length} group(s) had errors`);
      reset();
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed');
    } finally { setBusy(false); }
  }, [rows, warehouseId, token, reset, onDone]);

  const errorRows = preview?.totals.errorRows ?? 0;
  const canCommit = !!preview && preview.ok && !busy;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/30" onClick={() => { reset(); onClose(); }}>
      <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Import products &amp; sizes</h2>
            <p className="text-[11px] text-gray-400">Upload a CSV or Excel file to create SubProducts, Sizes and opening stock</p>
          </div>
          <button type="button" onClick={() => { reset(); onClose(); }} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50">
            <PiX className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="flex items-center justify-between">
            <button type="button" onClick={downloadTemplate} className="flex items-center gap-1.5 text-xs font-semibold text-[#b20202] hover:underline">
              <PiDownloadSimple className="h-3.5 w-3.5" /> Download template
            </button>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Warehouse for opening stock</span>
              <select value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setPreview(null); }}
                className="h-[32px] rounded-lg border border-gray-200 px-2 text-xs text-gray-700 focus:border-[#b20202] focus:outline-none">
                <option value="">— none —</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          </div>

          <div {...getRootProps()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${isDragActive ? 'border-[#b20202] bg-[#b20202]/5' : 'border-gray-200 hover:border-gray-300'}`}>
            <input {...getInputProps()} />
            <PiUploadSimple className="h-7 w-7 text-gray-300" />
            <p className="text-xs font-semibold text-gray-600">{fileName || 'Drop a .csv or .xlsx file, or click to browse'}</p>
            {rows.length > 0 && <p className="text-[11px] text-gray-400">{rows.length} rows parsed</p>}
          </div>

          {rows.length > 0 && !preview && (
            <button type="button" onClick={runPreview} disabled={busy}
              className="w-full rounded-lg bg-gray-900 py-2.5 text-xs font-bold text-white hover:bg-black disabled:opacity-40">
              {busy ? 'Validating…' : 'Validate & preview'}
            </button>
          )}

          {preview && (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: 'New products', value: preview.totals.willCreateProduct },
                  { label: 'Link existing', value: preview.totals.willLinkProduct },
                  { label: 'Update existing', value: preview.totals.willUpdateSubProduct },
                  { label: 'Sizes', value: preview.totals.sizes },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-gray-100 bg-gray-50 px-2 py-3">
                    <p className="text-sm font-bold tabular-nums text-gray-900">{s.value}</p>
                    <p className="text-[10px] text-gray-400">{s.label}</p>
                  </div>
                ))}
              </div>

              {preview.blocking.map((b) => (
                <div key={b} className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                  <PiWarningCircle className="h-4 w-4 shrink-0" /> {b}
                </div>
              ))}

              <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-100">
                {preview.groups.map((g) => (
                  <div key={g.key} className="border-b border-gray-50 px-3 py-2 last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-800">{g.productName || g.key}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${g.rowErrors.length ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {g.action} · {g.sizeCount} size{g.sizeCount === 1 ? '' : 's'}
                      </span>
                    </div>
                    {g.rowErrors.map((e, i) => (
                      <p key={i} className="mt-0.5 text-[10px] text-red-500">Row {e.rowNum}: {e.message}</p>
                    ))}
                    {g.sizeNotes.map((n, i) => (
                      <p key={`n${i}`} className="mt-0.5 text-[10px] text-gray-400">Row {n.rowNum}: {n.size} — {n.note}</p>
                    ))}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPreview(null)} className="flex-1 rounded-lg border border-gray-200 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                  Back
                </button>
                <button type="button" onClick={runCommit} disabled={!canCommit}
                  className="flex flex-[2] items-center justify-center gap-1.5 rounded-lg bg-[#b20202] py-2.5 text-xs font-bold text-white hover:bg-[#9a0101] disabled:opacity-40">
                  <PiCheckCircle className="h-4 w-4" />
                  {busy ? 'Importing…' : errorRows ? `Fix ${errorRows} error(s) to import` : 'Confirm import'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

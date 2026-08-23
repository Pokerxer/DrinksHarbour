'use client';

import { Fragment, useRef, useState } from 'react';
import {
  PiDownloadSimple,
  PiPackage,
  PiPlus,
  PiUploadSimple,
  PiWarningCircle,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import {
  buildPricelistCsv,
  duplicateLineKeys,
  effectiveNet,
  emptyLine,
  lineIsValid,
  netPrice,
  parsePricelistCsv,
  type EditorLine,
} from './helpers';
import { fmtCur } from '../purchases-analytics-helpers';
import { fraunces } from '../purchases-fonts';
import { ProductPicker } from './product-picker';
import PriceHistoryPanel from './price-history-panel';
import { LineItemsRow } from './line-items-row';

export default function LineItemsEditor({
  lines,
  currency,
  globalDiscountPercent = 0,
  onChange,
}: {
  lines: EditorLine[];
  currency: string;
  globalDiscountPercent?: number;
  onChange: (lines: EditorLine[]) => void;
}) {
  const [openHistory, setOpenHistory] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const invalidCount = lines.filter((l) => !lineIsValid(l)).length;
  const dupes = duplicateLineKeys(lines);
  const totalNet = lines.reduce((s, l) => s + netPrice(l), 0);
  const totalEffective = lines.reduce(
    (s, l) => s + effectiveNet(l, globalDiscountPercent),
    0
  );

  function update(i: number, patch: Partial<EditorLine>) {
    onChange(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function remove(i: number) {
    onChange(lines.filter((_, idx) => idx !== i));
  }

  function exportCsv() {
    const blob = new Blob([buildPricelistCsv(lines)], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pricelist-lines.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importCsv(file: File) {
    try {
      const text = await file.text();
      const imported = parsePricelistCsv(text);
      if (imported.length === 0) {
        toast.error('No rows found in CSV');
        return;
      }
      onChange([...lines, ...imported]);
      toast.success(`Imported ${imported.length} line(s)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#ece4d6] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ece4d6] px-5 py-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b20202]/70">
            Catalogue
          </p>
          <h2 className={`${fraunces.className} text-base font-semibold text-[#2a2420]`}>
            Price Lines{' '}
            <span className="text-sm font-normal text-gray-400">({lines.length})</span>
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {lines.length > 0 && (
            <button
              type="button"
              onClick={exportCsv}
              className="flex items-center gap-1 rounded-lg border border-[#ece4d6] px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-[#FAF8F3]"
            >
              <PiDownloadSimple className="h-3.5 w-3.5" /> Export CSV
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            aria-label="Import CSV"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importCsv(f);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1 rounded-lg border border-[#ece4d6] px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-[#FAF8F3]"
          >
            <PiUploadSimple className="h-3.5 w-3.5" /> Import CSV
          </button>
          <button
            type="button"
            onClick={() => onChange([...lines, emptyLine()])}
            className="flex items-center gap-1 rounded-lg border border-[#ece4d6] px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-[#FAF8F3]"
          >
            <PiPlus className="h-3.5 w-3.5" /> Blank Line
          </button>
          <ProductPicker onPick={(l) => onChange([...lines, l])} />
        </div>
      </div>

      {lines.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#b20202]/5">
            <PiPackage className="h-5 w-5 text-[#b20202]/40" />
          </span>
          <p className="text-sm text-gray-500">No price lines yet — add a product to start</p>
        </div>
      ) : (
        <>
          {invalidCount > 0 && (
            <div className="flex items-center gap-2 border-b border-red-100 bg-red-50/70 px-5 py-2 text-xs text-red-600">
              <PiWarningCircle className="h-4 w-4 shrink-0" />
              {invalidCount} line{invalidCount !== 1 ? 's' : ''} need a product
              name/link and a unit price above 0 before saving.
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-[#ece4d6] bg-[#FAF8F3] text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  <th className="px-4 py-2.5">Product</th>
                  <th className="w-28 px-3 py-2.5 text-right">Unit Price</th>
                  <th className="w-16 px-3 py-2.5 text-right">Disc %</th>
                  <th className="w-24 px-3 py-2.5 text-right">Net</th>
                  <th className="w-16 px-3 py-2.5 text-right">Min Qty</th>
                  <th className="w-16 px-3 py-2.5 text-right">Max Qty</th>
                  <th className="w-14 px-3 py-2.5 text-right">Lead (d)</th>
                  <th className="w-24 px-3 py-2.5">Packaging</th>
                  <th className="w-12 px-3 py-2.5 text-center">Pref</th>
                  <th className="w-10 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1ece2]">
                {lines.map((line, i) => {
                  const invalid = !lineIsValid(line);
                  const isDupe = dupes.has(line._key);
                  return (
                    <Fragment key={line._key}>
                      <LineItemsRow
                        line={line}
                        index={i}
                        invalid={invalid}
                        isDupe={isDupe}
                        historyOpen={openHistory === line._key}
                        currency={currency}
                        onToggleHistory={() =>
                          setOpenHistory(
                            openHistory === line._key ? null : line._key
                          )
                        }
                        onUpdate={(patch) => update(i, patch)}
                        onRemove={() => remove(i)}
                        onTogglePreferred={() =>
                          update(i, { isPreferred: !line.isPreferred })
                        }
                      />
                      {openHistory === line._key && (
                        <tr>
                          <td colSpan={10} className="bg-[#FAF8F3]/40">
                            <PriceHistoryPanel
                              history={line.priceHistory}
                              currency={currency}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-1 border-t border-[#ece4d6] bg-[#FAF8F3]/50 px-5 py-2.5 text-xs text-gray-500">
            <span>
              Catalogue value{' '}
              <span className={`${fraunces.className} ml-1 font-semibold tabular-nums text-[#2a2420]`}>
                {fmtCur(totalNet, currency)}
              </span>
            </span>
            {globalDiscountPercent > 0 && (
              <span>
                After global −{globalDiscountPercent}%{' '}
                <span className={`${fraunces.className} ml-1 font-semibold tabular-nums text-[#3d6b5c]`}>
                  {fmtCur(totalEffective, currency)}
                </span>
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

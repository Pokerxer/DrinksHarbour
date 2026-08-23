'use client';

import { Fragment, useRef, useState } from 'react';
import {
  PiDownloadSimple,
  PiPackage,
  PiPlus,
  PiStar,
  PiStarFill,
  PiTrash,
  PiUploadSimple,
  PiWarningCircle,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import {
  buildPricelistCsv,
  duplicateLineKeys,
  effectiveNet,
  emptyLine,
  lineDelta,
  lineIsValid,
  netPrice,
  parsePricelistCsv,
  type EditorLine,
} from './helpers';
import { fmtCur } from '../purchases-analytics-helpers';
import { fraunces } from '../purchases-fonts';
import { ProductPicker } from './product-picker';
import DeltaBadge from './delta-badge';
import PriceHistoryPanel from './price-history-panel';

const inputCls = (invalid: boolean) =>
  `w-full rounded border px-2 py-1 text-right text-xs tabular-nums focus:outline-none ${
    invalid
      ? 'border-red-300 bg-red-50/60 focus:border-red-400'
      : 'border-[#ece4d6] focus:border-[#b20202]'
  }`;

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
                      <tr
                        className={
                          invalid ? 'bg-red-50/30 hover:bg-red-50/50' : 'hover:bg-[#FAF8F3]/60'
                        }
                      >
                        <td className="px-4 py-2">
                          {line.subProductId ? (
                            <>
                              <p className="font-medium text-[#2a2420]">
                                {line.subProductName || line.productName}
                              </p>
                              <p className="text-[11px] text-gray-400">
                                {[line.sizeName, line.sku].filter(Boolean).join(' · ') || '—'}
                              </p>
                              <div className="mt-0.5 flex items-center gap-1.5">
                                <DeltaBadge delta={lineDelta(line)} />
                                {isDupe && (
                                  <span
                                    className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600"
                                    title="This product+size appears in more than one line"
                                  >
                                    <PiWarningCircle className="h-2.5 w-2.5" /> Duplicate
                                  </span>
                                )}
                                {line.priceHistory && line.priceHistory.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOpenHistory(openHistory === line._key ? null : line._key)
                                    }
                                    className="text-[10px] font-medium text-gray-400 underline-offset-2 hover:text-[#b20202] hover:underline"
                                  >
                                    {openHistory === line._key
                                      ? 'Hide history'
                                      : `History (${line.priceHistory.length})`}
                                  </button>
                                )}
                              </div>
                            </>
                          ) : (
                            <input
                              value={line.productName}
                              onChange={(e) => update(i, { productName: e.target.value })}
                              placeholder="Product name"
                              aria-label={`Line ${i + 1} product name`}
                              className={`w-44 rounded border px-2 py-1 text-xs focus:outline-none ${
                                invalid && !(line.productName ?? '').trim()
                                  ? 'border-red-300 bg-red-50/60 focus:border-red-400'
                                  : 'border-[#ece4d6] focus:border-[#b20202]'
                              }`}
                            />
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.unitPrice}
                            onChange={(e) => update(i, { unitPrice: Number(e.target.value) })}
                            aria-label={`Line ${i + 1} unit price`}
                            className={inputCls(invalid && !(Number(line.unitPrice) > 0))}
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={line.discountPercent}
                            onChange={(e) => update(i, { discountPercent: Number(e.target.value) })}
                            aria-label={`Line ${i + 1} discount percent`}
                            className={inputCls(false)}
                          />
                        </td>
                        <td
                          className={`${fraunces.className} px-3 py-2 text-right font-semibold tabular-nums text-[#2a2420]`}
                        >
                          {fmtCur(netPrice(line), currency)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min="1"
                            value={line.minQuantity ?? 1}
                            onChange={(e) => update(i, { minQuantity: Number(e.target.value) })}
                            aria-label={`Line ${i + 1} minimum quantity`}
                            className={inputCls(false)}
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            value={line.maxQuantity ?? ''}
                            onChange={(e) =>
                              update(i, {
                                maxQuantity: e.target.value === '' ? undefined : Number(e.target.value),
                              })
                            }
                            placeholder="∞"
                            aria-label={`Line ${i + 1} maximum quantity`}
                            className={inputCls(false)}
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            value={line.leadTimeDays ?? 0}
                            onChange={(e) => update(i, { leadTimeDays: Number(e.target.value) })}
                            aria-label={`Line ${i + 1} lead time days`}
                            className={inputCls(false)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={line.packaging ?? ''}
                            onChange={(e) => update(i, { packaging: e.target.value })}
                            placeholder="carton…"
                            aria-label={`Line ${i + 1} packaging`}
                            className="w-full rounded border border-[#ece4d6] px-2 py-1 text-xs focus:border-[#b20202] focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => update(i, { isPreferred: !line.isPreferred })}
                            title={line.isPreferred ? 'Preferred vendor line' : 'Mark preferred'}
                            aria-label={line.isPreferred ? 'Unmark preferred' : 'Mark preferred'}
                            className="text-gray-300 transition-colors hover:text-[#c8932c]"
                          >
                            {line.isPreferred ? (
                              <PiStarFill className="h-4 w-4 text-[#c8932c]" />
                            ) : (
                              <PiStar className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => remove(i)}
                            aria-label={`Remove line ${i + 1}`}
                            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                          >
                            <PiTrash className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                      {openHistory === line._key && (
                        <tr>
                          <td colSpan={10} className="bg-[#FAF8F3]/40">
                            <PriceHistoryPanel history={line.priceHistory} currency={currency} />
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

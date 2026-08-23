'use client';

import { useState } from 'react';
import { PiInfo, PiPrinter, PiReceipt, PiX } from 'react-icons/pi';
import type { InventoryMovement } from '@/services/inventory.service';
import {
  TYPE_LABEL,
  byLabel,
  fmtDate,
  fmtDateTime,
  fmtNgn,
  moveDate,
  printMoves,
  productLabel,
  qtyCls,
  qtySign,
  referenceLabel,
  sizeLabel,
  warehouseLabel,
  whCell,
} from './inventory-receipts-support';
import { STATUS_CLS, lineCost } from './inventory-movements-presets';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="shrink-0 font-semibold text-gray-500">{label}</span>
      <span className="truncate text-right font-medium capitalize text-gray-800">
        {value}
      </span>
    </div>
  );
}

export default function MoveDetail({
  move,
  docTitle,
  onClose,
}: {
  move: InventoryMovement;
  docTitle: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'details' | 'document'>('details');
  const size = sizeLabel(move);
  const po = move.relatedPurchaseOrder as { poNumber?: string } | undefined;
  const isTransfer = move.category === 'transfer';

  const infoRows: { label: string; value: string }[] = [
    { label: 'Type', value: TYPE_LABEL[move.type] ?? move.type },
    ...(isTransfer
      ? [
          { label: 'From', value: warehouseLabel(move.sourceWarehouse) },
          { label: 'To', value: warehouseLabel(move.destinationWarehouse) },
        ]
      : [{ label: 'Warehouse', value: warehouseLabel(move.warehouse) }]),
    { label: 'Reference', value: move.reference ?? '\u2014' },
    ...(po?.poNumber ? [{ label: 'Purchase Order', value: po.poNumber }] : []),
    ...(move.supplierName
      ? [{ label: 'Supplier', value: move.supplierName }]
      : []),
    ...(move.batchNumber ? [{ label: 'Batch', value: move.batchNumber }] : []),
    ...(move.lotNumber ? [{ label: 'Lot', value: move.lotNumber }] : []),
    ...(move.expirationDate
      ? [{ label: 'Expiry', value: fmtDate(move.expirationDate) }]
      : []),
    { label: 'Source', value: move.source ?? '\u2014' },
    { label: 'By', value: byLabel(move) },
    ...(move.quantityBefore != null && move.quantityAfter != null
      ? [
          {
            label: 'Stock level',
            value: `${move.quantityBefore} \u2192 ${move.quantityAfter}`,
          },
        ]
      : []),
  ];

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-900">
              {referenceLabel(move)}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${STATUS_CLS[move.status] ?? STATUS_CLS.cancelled}`}
            >
              {move.status}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-gray-400">
            {fmtDateTime(moveDate(move))}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => printMoves([move], docTitle)}
            aria-label={`Print ${docTitle.toLowerCase()}`}
            title={`Print ${docTitle.toLowerCase()}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-[#b20202]"
          >
            <PiPrinter className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            title="Close details"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-700"
          >
            <PiX className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex shrink-0 border-b border-gray-100 text-xs font-semibold">
        {(
          [
            {
              id: 'details',
              label: 'Details',
              icon: <PiInfo className="h-3.5 w-3.5" />,
            },
            {
              id: 'document',
              label: 'Document',
              icon: <PiReceipt className="h-3.5 w-3.5" />,
            },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 transition-colors ${
              tab === t.id
                ? 'border-b-2 border-[#b20202] text-[#b20202]'
                : 'border-b-2 border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'details' ? (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
            {[
              {
                label: 'Quantity',
                value: `${qtySign(move)}${Math.abs(move.quantity)}`,
                cls: qtyCls(move),
              },
              {
                label: 'Unit cost',
                value: move.unitCost != null ? fmtNgn(move.unitCost) : '\u2014',
                cls: 'text-gray-900',
              },
              {
                label: 'Total cost',
                value: fmtNgn(lineCost(move)),
                cls: 'text-[#b20202]',
              },
            ].map(({ label, value, cls }) => (
              <div key={label} className="px-4 py-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  {label}
                </p>
                <p className={`mt-0.5 text-sm font-bold tabular-nums ${cls}`}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="border-b border-gray-100 px-5 py-3">
            <p className="text-sm font-bold text-gray-900">
              {productLabel(move)}
            </p>
            {size && <p className="text-xs text-gray-400">{size}</p>}
          </div>

          <div className="space-y-1.5 border-b border-gray-100 px-5 py-3 text-xs">
            {infoRows.map(({ label, value }) => (
              <InfoRow key={label} label={label} value={value} />
            ))}
          </div>

          {(move.reason || move.notes) && (
            <div className="space-y-2 px-5 py-3 text-xs">
              {move.reason && (
                <div>
                  <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Reason
                  </p>
                  <p className="text-gray-600">{move.reason}</p>
                </div>
              )}
              {move.notes && (
                <div>
                  <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Notes
                  </p>
                  <p className="whitespace-pre-line text-gray-600">
                    {move.notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
          <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between border-b-2 border-[#b20202] pb-3">
              <div>
                <p className="text-sm font-bold text-gray-900">{docTitle}</p>
                <p className="text-[10px] text-gray-400">
                  {fmtDateTime(moveDate(move))}
                </p>
              </div>
              <span className="text-[10px] font-extrabold text-[#b20202]">
                DRINKSHARBOUR
              </span>
            </div>
            <table className="mt-3 w-full text-[11px]">
              <tbody>
                {[
                  [
                    'Product',
                    `${productLabel(move)}${size ? ` \u00b7 ${size}` : ''}`,
                  ],
                  ['Type', TYPE_LABEL[move.type] ?? move.type],
                  ['Warehouse', whCell(move)],
                  ['Reference', referenceLabel(move)],
                  ['Quantity', `${qtySign(move)}${Math.abs(move.quantity)}`],
                  [
                    'Unit cost',
                    move.unitCost != null ? fmtNgn(move.unitCost) : '\u2014',
                  ],
                  ['Total', fmtNgn(lineCost(move))],
                  ...(move.reason ? [['Reason', move.reason] as const] : []),
                ].map(([k, v]) => (
                  <tr
                    key={k}
                    className="border-b border-gray-50 last:border-0"
                  >
                    <td className="py-1.5 pr-3 font-semibold text-gray-500">
                      {k}
                    </td>
                    <td className="py-1.5 text-right font-medium text-gray-800">
                      {v}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              type="button"
              onClick={() => printMoves([move], docTitle)}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#b20202] py-2 text-xs font-bold text-white hover:bg-[#9a0101]"
            >
              <PiPrinter className="h-3.5 w-3.5" /> Print {docTitle}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

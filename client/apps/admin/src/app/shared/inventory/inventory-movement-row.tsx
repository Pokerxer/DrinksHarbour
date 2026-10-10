import type { InventoryMovement } from '@/services/inventory.service';
import { PiCheckSquare, PiSquare, PiPrinter } from 'react-icons/pi';
import {
  TYPE_COLOR,
  byLabel,
  fmtDate,
  fmtNgn,
  fmtTime,
  productLabel,
  referenceLabel,
  sizeLabel,
  warehouseLabel,
} from './inventory-receipts-support';
import {
  movementLabel,
  changeLabel,
  movementDelta,
  transferRoute,
} from './inventory-stock-history';
import { movementCost } from './inventory-movement-view';
import { refId } from './inventory-dashboard-analysis';
import StockProductLink from './inventory-stock-product-link';
import { printMovementHistory as printMoves } from './inventory-movement-export';
import { requestDocumentExport } from '@/utils/print/document-export';
import { buildMovementDocument } from './inventory-movement-document';
import { balanceLabel } from './inventory-stock-history';
import { movementSourceLabel } from './inventory-delivery-view';
import { receiptLabel } from './inventory-receipt-view';
import { lineCost } from './inventory-movements-presets';
const moveDate = (move: InventoryMovement) => move.createdAt;
export default function MovementRow({
  move: m,
  selected: isSel,
  checked: isChk,
  select,
  toggle,
  docTitle,
  disabled,
  receipt = false,
  delivery = false,
  internal = false,
  adjustment = false,
}: {
  move: InventoryMovement;
  selected: boolean;
  checked: boolean;
  select: () => void;
  toggle: () => void;
  docTitle: string;
  disabled: boolean;
  receipt?: boolean;
  delivery?: boolean;
  internal?: boolean;
  adjustment?: boolean;
}) {
  const size = sizeLabel(m);
  return (
    <tr
      key={m._id}
      className={`cursor-pointer border-b border-gray-100/80 transition-colors ${
        isSel
          ? 'bg-[#b20202] text-white'
          : isChk
            ? 'border-l-2 border-l-[#b20202] bg-[#b20202]/5'
            : 'border-l-2 border-l-transparent hover:bg-gray-50/80'
      }`}
    >
      <td className="w-8 px-2 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          aria-label={isChk ? 'Deselect line' : 'Select line'}
          onClick={() => toggle()}
          className="text-gray-300 transition-colors hover:text-[#b20202]"
        >
          {isChk ? (
            <PiCheckSquare className="h-4 w-4 text-[#b20202]" />
          ) : (
            <PiSquare className="h-4 w-4" />
          )}
        </button>
      </td>
      <td className="px-3 py-2.5" onClick={() => select()}>
        <div
          className={`text-xs font-medium leading-tight ${isSel ? 'text-white' : 'text-gray-800'}`}
        >
          {fmtDate(moveDate(m))}
        </div>
        <div className={`mt-0.5 font-mono text-[10px] ${isSel ? 'text-red-200' : 'text-gray-400'}`}>
          {fmtTime(moveDate(m))}
        </div>
      </td>
      <td className="max-w-[180px] px-3 py-2.5" onClick={() => select()}>
        <div className={`truncate text-xs font-semibold ${isSel ? 'text-white' : 'text-gray-800'}`}>
          <StockProductLink id={refId(m.subProduct)} name={productLabel(m)} />
        </div>
        {size && (
          <div className={`truncate text-[10px] ${isSel ? 'text-red-200' : 'text-gray-400'}`}>
            {size}
          </div>
        )}
      </td>
      <td className="px-3 py-2.5" onClick={() => select()}>
        {isSel ? (
          <span className="text-[11px] capitalize text-red-100">
            {receipt ? receiptLabel(m) : movementLabel(m)}
          </span>
        ) : (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_COLOR[m.type] ?? 'bg-gray-100 text-gray-600'}`}
          >
            {receipt ? receiptLabel(m) : movementLabel(m)}
          </span>
        )}
        <div className="mt-1 text-[10px] capitalize opacity-70">{m.status}</div>
      </td>
      <td
        className={`px-3 py-2.5 text-xs ${isSel ? 'text-red-100' : 'text-gray-600'}`}
        onClick={() => select()}
      >
        {warehouseLabel(m.warehouse)}
        {transferRoute(m) && (
          <div className="mt-0.5 text-[10px] opacity-70">{transferRoute(m)}</div>
        )}
      </td>
      {receipt && (
        <td
          className={`max-w-[180px] px-3 py-2.5 text-xs ${isSel ? 'text-red-100' : 'text-gray-600'}`}
          onClick={select}
        >
          {m.supplierName || '—'}
        </td>
      )}
      {delivery && (
        <td
          className={`px-3 py-2.5 text-xs ${isSel ? 'text-red-100' : 'text-gray-600'}`}
          onClick={select}
        >
          {movementSourceLabel(m.source)}
        </td>
      )}
      <td
        className={`max-w-[110px] truncate px-3 py-2.5 text-xs ${isSel ? 'text-red-100' : 'text-gray-500'}`}
        onClick={() => select()}
      >
        <button
          type="button"
          onClick={select}
          aria-label={`${adjustment ? 'View adjustment' : receipt ? 'View receipt' : delivery ? 'View delivery' : internal ? 'View internal move' : 'View movement'} ${referenceLabel(m)} for ${productLabel(m)}`}
          className="text-left font-medium underline-offset-2 hover:underline focus-visible:underline"
        >
          {referenceLabel(m)}
        </button>
      </td>
      {adjustment && (
        <td
          className={`max-w-[180px] px-3 py-2.5 text-xs ${isSel ? 'text-white' : 'text-gray-600'}`}
          onClick={select}
          title={m.reason || undefined}
        >
          <span className="line-clamp-2">{m.reason?.trim() || 'No reason recorded'}</span>
        </td>
      )}
      <td
        className={`px-3 py-2.5 text-right text-xs font-bold tabular-nums ${isSel ? 'text-white' : (movementDelta(m) ?? 0) > 0 ? 'text-emerald-600' : (movementDelta(m) ?? 0) < 0 ? 'text-red-600' : 'text-gray-400'}`}
        onClick={() => select()}
      >
        {changeLabel(m)}
        {(m.status !== 'confirmed' || ['reserved', 'released'].includes(m.type)) && (
          <div className="text-[10px] font-normal">
            Recorded: {Number.isFinite(m.quantity) ? Math.abs(m.quantity) : '—'}
          </div>
        )}
      </td>
      <td
        className={`px-3 py-2.5 text-right text-xs font-bold tabular-nums ${isSel ? 'text-white' : 'text-gray-900'}`}
        onClick={() => select()}
      >
        {movementCost(m) === null ? '—' : fmtNgn(lineCost(m))}
      </td>
      <td
        className={`max-w-[90px] truncate px-3 py-2.5 text-xs ${isSel ? 'text-red-100' : 'text-gray-600'}`}
        onClick={() => select()}
      >
        {byLabel(m)}
      </td>
      {(receipt || delivery || internal || adjustment) && (
        <td
          className={`whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums ${isSel ? 'text-red-100' : 'text-gray-600'}`}
          onClick={select}
        >
          {balanceLabel(m)}
        </td>
      )}
      <td className="w-8 px-2 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          aria-label={`Print ${docTitle.toLowerCase()} for this line`}
          disabled={disabled}
          onClick={() =>
            receipt || delivery || internal || adjustment
              ? requestDocumentExport(buildMovementDocument(m, docTitle))
              : printMoves([m], docTitle)
          }
          className={`transition-colors ${isSel ? 'text-white/50 hover:text-white' : 'text-gray-300 hover:text-[#b20202]'}`}
        >
          <PiPrinter className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}

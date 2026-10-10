import type { InventoryMovement } from '@/services/inventory.service';
import { routes } from '@/config/routes';
import { refId } from './inventory-dashboard-analysis';
import {
  byLabel,
  fmtDate,
  productLabel,
  referenceLabel,
  sizeLabel,
  warehouseLabel,
} from './inventory-receipts-support';
import {
  balanceLabel,
  changeLabel,
  historyDate,
  movementDelta,
  movementLabel,
  transferRoute,
} from './inventory-stock-history';
import { movementCost } from './inventory-movement-view';
import { fmtAmt } from '@/utils/print/print-shared';
export type MovementInfoRow = { label: string; value: string; href?: string };
const known = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
export const movementMoney = (value: unknown) => (known(value) ? fmtAmt(value, 'NGN') : '—');
export function movementDetails(move: InventoryMovement) {
  const warehouse = (label: string, value: InventoryMovement['warehouse']): MovementInfoRow => ({
    label,
    value: warehouseLabel(value),
    href: refId(value) ? routes.warehouses.locationAnalysis(refId(value)) : undefined,
  });
  const sku = typeof move.subProduct === 'object' ? move.subProduct?.sku : '';
  const purchase =
    typeof move.relatedPurchaseOrder === 'object' ? move.relatedPurchaseOrder?.poNumber : '';
  const order =
    typeof move.relatedOrder === 'object'
      ? move.relatedOrder?.receiptNumber || move.relatedOrder?.orderNumber
      : '';
  const recorded = historyDate(move);
  const performed =
    move.performedAt &&
    Number.isFinite(new Date(move.performedAt).getTime()) &&
    new Date(move.performedAt).getTime() !== new Date(move.createdAt).getTime()
      ? new Date(move.performedAt).toLocaleString('en-GB')
      : '';
  const rows: MovementInfoRow[] = [
    { label: 'Type', value: movementLabel(move) },
    warehouse('Warehouse', move.warehouse),
    ...(transferRoute(move)
      ? [warehouse('From', move.sourceWarehouse), warehouse('To', move.destinationWarehouse)]
      : []),
    { label: 'Reference', value: move.reference || referenceLabel(move) },
    ...(purchase ? [{ label: 'Purchase order', value: purchase }] : []),
    ...(order ? [{ label: 'Sales reference', value: order }] : []),
    ...(sku ? [{ label: 'SKU', value: sku }] : []),
    ...(move.supplierName ? [{ label: 'Supplier', value: move.supplierName }] : []),
    ...(move.batchNumber ? [{ label: 'Batch', value: move.batchNumber }] : []),
    ...(move.lotNumber ? [{ label: 'Lot', value: move.lotNumber }] : []),
    ...(move.expirationDate
      ? [
          {
            label: 'Expiry',
            value: Number.isFinite(new Date(move.expirationDate).getTime())
              ? fmtDate(move.expirationDate)
              : '—',
          },
        ]
      : []),
    { label: 'Source', value: move.source || '—' },
    { label: 'By', value: byLabel(move) },
    { label: 'Stock balance', value: balanceLabel(move) },
    { label: 'Recorded date', value: recorded },
    ...(performed ? [{ label: 'Performed date', value: performed }] : []),
  ];
  return {
    rows,
    sku,
    productId: refId(move.subProduct),
    productName: productLabel(move),
    size: sizeLabel(move),
    quantity: known(move.quantity) ? String(Math.abs(move.quantity)) : '—',
    change: changeLabel(move),
    delta: movementDelta(move),
    unitCost: movementMoney(move.unitCost),
    cost: movementMoney(movementCost(move)),
    recorded,
    performed,
    postingNote:
      move.status !== 'confirmed'
        ? 'This movement has not been posted to stock.'
        : ['reserved', 'released'].includes(move.type)
          ? 'Reservations and releases do not change on-hand stock.'
          : 'Stock balances show this recorded movement, not the current stock level.',
  };
}

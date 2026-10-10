import type { InventoryMovement } from '@/services/inventory.service';
import type { DocumentModel } from '@/utils/print/doc-model';
import { routes } from '@/config/routes';
import { movementDetails } from './inventory-movement-detail-data';
import { refId } from './inventory-dashboard-analysis';
import {
  balanceLabel,
  changeLabel,
  historyDate,
  movementLabel,
  transferRoute,
} from './inventory-stock-history';
import {
  byLabel,
  productLabel,
  referenceLabel,
  sizeLabel,
  warehouseLabel,
} from './inventory-receipts-support';

/** References are display text; only persisted relationships can identify an invoice. */
export function movementDocumentLink(
  move: InventoryMovement,
): { href: string; label: string } | null {
  const purchase = refId(move.relatedPurchaseOrder);
  if (purchase)
    return { href: routes.eCommerce.purchaseDetails(purchase), label: 'Open purchase document' };
  const order = refId(move.relatedOrder);
  return order ? { href: routes.eCommerce.orderDetails(order), label: 'Open order invoice' } : null;
}
export function buildMovementDocument(move: InventoryMovement, title: string): DocumentModel {
  const detail = movementDetails(move);
  return {
    kind: 'stock',
    companyName: 'DrinksHarbour',
    department: 'Inventory',
    docTitle: title,
    number: referenceLabel(move) === '—' ? move._id : referenceLabel(move),
    status: move.status,
    watermark: move.status !== 'confirmed' ? move.status.toUpperCase() : undefined,
    parties: [
      {
        heading: 'Warehouse',
        name: warehouseLabel(move.warehouse),
        lines: transferRoute(move) ? [transferRoute(move)] : [],
      },
    ],
    meta: [
      ['Recorded date', historyDate(move)],
      ['Movement', movementLabel(move)],
      ['Recorded by', byLabel(move)],
      ['Stock change', changeLabel(move)],
      ['Stock balance', balanceLabel(move)],
      ['Movement ID', move._id],
      ...detail.rows
        .filter((row) =>
          [
            'Reference',
            'Purchase order',
            'Sales reference',
            'SKU',
            'Source',
            'Supplier',
            'Batch',
            'Lot',
            'Expiry',
            'Performed date',
          ].includes(row.label),
        )
        .map((row) => [row.label, row.value] as [string, string]),
    ],
    table: {
      columns: [
        { label: 'Product / Size' },
        { label: 'Quantity', align: 'right' },
        { label: 'Unit cost', align: 'right' },
        { label: 'Recorded value', align: 'right' },
      ],
      rows: [
        [
          { text: productLabel(move), sub: sizeLabel(move) || undefined },
          { text: detail.quantity },
          { text: detail.unitCost },
          { text: detail.cost, strong: true },
        ],
      ],
    },
    totals: [{ label: 'Recorded stock value', value: detail.cost, variant: 'grand' }],
    sections: [
      ...(move.reason ? [{ title: 'Reason', body: move.reason }] : []),
      ...(move.notes ? [{ title: 'Notes', body: move.notes }] : []),
      {
        title: 'Document information',
        body: `This document records a stock movement. Invoice taxes, payments and refund totals are shown on the original purchase or sales document. ${detail.postingNote}`,
      },
    ],
    signatures: [],
    fileName: `stock-movement-${move._id.replace(/[^a-zA-Z0-9_-]/g, '-')}.pdf`,
  };
}

export function movementDocumentLinks(move: InventoryMovement) {
  const links: { href: string; label: string }[] = [];
  const purchase = refId(move.relatedPurchaseOrder),
    order = refId(move.relatedOrder);
  if (purchase)
    links.push({
      href: routes.eCommerce.purchaseDetails(purchase),
      label: 'Open purchase document',
    });
  if (order)
    links.push({ href: routes.eCommerce.orderDetails(order), label: 'Open order invoice' });
  return links;
}

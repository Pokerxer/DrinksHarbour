'use client';

// app/shared/warehouses/warehouse-detail/transfer-stock-modal.tsx
// Thin mount for the existing WarehouseTransferDrawer (shared with the
// sub-product LocationsTab) pre-filled for one stock line.

import WarehouseTransferDrawer from '../warehouse-transfer-drawer';
import type { WarehouseStockRow } from '@/services/warehouseStock.service';
import {
  productNameOf as nameOf,
  skuOf,
  sizeLabelOf as sizeOf,
  subProductIdOf,
  sizeIdOf,
} from '../warehouse-ref-helpers';

export default function TransferStockModal({
  warehouseId,
  row,
  onClose,
  onDone,
}: {
  warehouseId: string;
  row: WarehouseStockRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const subProduct = subProductIdOf(row);
  const size = sizeIdOf(row);
  if (!subProduct || !size) return null;

  const name = nameOf(row) || skuOf(row);
  const label = name ? `${name} · ${sizeOf(row)}` : 'Stock line';

  return (
    <WarehouseTransferDrawer
      fromWarehouseId={warehouseId}
      subProductId={subProduct}
      sizeId={size}
      label={label}
      maxQuantity={row.currentQuantity}
      onClose={onClose}
      onDone={onDone}
    />
  );
}

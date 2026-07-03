'use client';

import InventoryMovementsBrowser from './inventory-movements-browser';

/** Receipts = the generalized movements browser with the 'receipts' preset. */
export default function InventoryReceipts() {
  return <InventoryMovementsBrowser preset="receipts" />;
}

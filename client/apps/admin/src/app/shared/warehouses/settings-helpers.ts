// app/shared/warehouses/settings-helpers.ts
//
// Pure consistency rules for the warehouse settings form. The settings page
// renders whatever warnings this returns as a banner and disables dependent
// controls — keeping the rules here (not in JSX) makes them unit-testable and
// keeps the form dumb.

import type { WarehouseSettings } from '@/services/warehouse.service';

export function warehouseSettingsWarnings(
  wh: WarehouseSettings
): string[] {
  const warnings: string[] = [];

  // Batch-dependent features do nothing without batch data to inspect.
  if (!wh.batchTrackingEnabled) {
    const orphaned: string[] = [];
    if (wh.blockExpiredStock) orphaned.push('Block expired stock');
    if (wh.fefoPicking) orphaned.push('FEFO picking');
    if (wh.autoQuarantineExpired) orphaned.push('Auto-quarantine expired');
    if (wh.nearExpiryDays > 0) orphaned.push('Near-expiry warning');
    if (orphaned.length > 0) {
      warnings.push(
        `${orphaned.join(', ')} ${orphaned.length === 1 ? 'depends' : 'depend'} on batch tracking, which is currently off — these will have no effect until batches are tracked.`
      );
    }
  }

  // An overstock ceiling at or below the low-stock threshold would flag an
  // item as overstocked and low-stock at the same time.
  if (
    wh.overstockCeiling > 0 &&
    wh.overstockCeiling <= wh.lowStockThreshold
  ) {
    warnings.push(
      `Overstock ceiling (${wh.overstockCeiling}) should be higher than the low-stock threshold (${wh.lowStockThreshold}), otherwise items can be flagged overstocked and low at once.`
    );
  }

  // Approval rules are unreachable when transfers themselves are locked.
  if (!wh.allowInterWarehouseTransfers && wh.requireTransferApproval) {
    warnings.push(
      'Transfer approval is enabled but inter-warehouse transfers are disabled — approval can never trigger. Re-enable transfers or turn approval off.'
    );
  }

  return warnings;
}

/** True when a control's meaning depends on batch tracking being on. */
export function requiresBatchTracking(wh: WarehouseSettings): boolean {
  return !wh.batchTrackingEnabled;
}

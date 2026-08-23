import { describe, expect, it } from 'vitest';
import type { WarehouseSettings } from '@/services/warehouse.service';
import {
  requiresBatchTracking,
  warehouseSettingsWarnings,
} from './settings-helpers';

const BASE: WarehouseSettings = {
  defaultWarehouse: '',
  lowStockThreshold: 10,
  valuationMethod: 'fifo',
  allowNegativeStock: false,
  batchTrackingEnabled: true,
  nearExpiryDays: 30,
  reorderPoint: 5,
  reorderQuantity: 12,
  flagBelowReorderPoint: true,
  outOfStockAlert: true,
  overstockCeiling: 0,
  requireTransferApproval: false,
  allowInterWarehouseTransfers: true,
  transferApprovalThreshold: 0,
  blockExpiredStock: false,
  fefoPicking: false,
  autoQuarantineExpired: false,
};

describe('warehouseSettingsWarnings', () => {
  it('is silent on a coherent config', () => {
    expect(warehouseSettingsWarnings(BASE)).toEqual([]);
  });

  it('flags batch-dependent toggles left on while tracking is off', () => {
    const wh = {
      ...BASE,
      batchTrackingEnabled: false,
      blockExpiredStock: true,
      fefoPicking: true,
      autoQuarantineExpired: true,
      nearExpiryDays: 14,
    };
    const w = warehouseSettingsWarnings(wh);
    expect(w).toHaveLength(1);
    expect(w[0]).toContain('Block expired stock, FEFO picking');
    expect(w[0]).toContain('Auto-quarantine expired');
    expect(w[0]).toContain('Near-expiry warning');
  });

  it('does not flag batch-dependent toggles when they are off', () => {
    const wh = { ...BASE, batchTrackingEnabled: false, nearExpiryDays: 0 };
    expect(warehouseSettingsWarnings(wh)).toEqual([]);
  });

  it('flags an overstock ceiling at or below the low-stock threshold', () => {
    expect(
      warehouseSettingsWarnings({ ...BASE, overstockCeiling: 10 })
    ).toHaveLength(1);
    expect(
      warehouseSettingsWarnings({ ...BASE, overstockCeiling: 5 })
    ).toHaveLength(1);
    // Above the threshold and disabled (0) are both fine.
    expect(
      warehouseSettingsWarnings({ ...BASE, overstockCeiling: 50 })
    ).toEqual([]);
    expect(
      warehouseSettingsWarnings({ ...BASE, overstockCeiling: 0 })
    ).toEqual([]);
  });

  it('flags unreachable transfer approval when transfers are locked', () => {
    const wh = {
      ...BASE,
      allowInterWarehouseTransfers: false,
      requireTransferApproval: true,
    };
    expect(warehouseSettingsWarnings(wh)).toHaveLength(1);
    // Approval alone (transfers allowed) is fine.
    expect(
      warehouseSettingsWarnings({ ...BASE, requireTransferApproval: true })
    ).toEqual([]);
  });
});

describe('requiresBatchTracking', () => {
  it('mirrors the batch-tracking switch for control disabling', () => {
    expect(requiresBatchTracking(BASE)).toBe(false);
    expect(requiresBatchTracking({ ...BASE, batchTrackingEnabled: false })).toBe(
      true
    );
  });
});

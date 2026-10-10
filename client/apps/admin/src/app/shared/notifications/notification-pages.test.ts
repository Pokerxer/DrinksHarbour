import { describe, it, expect } from 'vitest';
import {
  notificationPages,
  canOpenNotificationPage,
} from '@/config/notification-pages';
import { roleCanAccessRoute } from '@/config/route-roles';
import { safeAction } from './inbox-filters';
import { formatCover, methodLabel } from './insights/presentation';
describe('individual notification pages', () => {
  it('exposes every approved route independently', () => {
    expect(notificationPages.map((p) => p.href)).toEqual([
      '/notifications',
      '/notifications/stock',
      '/notifications/warehouses',
      '/notifications/performance',
      '/notifications/forecasts',
      '/notifications/restock',
      '/notifications/vendor-orders',
      '/notifications/products',
      '/notifications/promotions',
      '/notifications/expiry',
    ]);
  });
  it('staff report access cannot reveal vendor plans', () => {
    expect(
      roleCanAccessRoute('/notifications/vendor-orders', 'tenant_staff', [
        'reports:read',
      ])
    ).toBe(false);
    expect(
      roleCanAccessRoute('/notifications/forecasts', 'tenant_staff', [
        'reports:read',
      ])
    ).toBe(true);
    expect(
      canOpenNotificationPage('/notifications/warehouses', 'tenant_staff', [])
    ).toBe(true);
    expect(
      canOpenNotificationPage('/notifications/forecasts', 'tenant_staff', [])
    ).toBe(false);
  });
  it('safe deep links only accept known routes and scoped ids', () => {
    expect(
      safeAction('/notifications/warehouses?warehouseId=' + 'a'.repeat(24))
    ).toBe(true);
    expect(safeAction('/notifications/forecasts?tenantId=x')).toBe(false);
    expect(safeAction('/notifications/other')).toBe(false);
  });
  it('labels unsupported and fallback predictions honestly', () => {
    expect(formatCover(null)).toBe('Beyond forecast horizon');
    expect(formatCover(undefined)).toBe('Unknown');
    expect(methodLabel('historical_baseline')).toBe('Historical baseline');
    expect(methodLabel('trained_forecast')).toBe('AI forecast');
  });
});

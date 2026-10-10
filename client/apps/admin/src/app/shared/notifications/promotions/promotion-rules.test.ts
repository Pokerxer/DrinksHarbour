import { expect, it } from 'vitest';
import {
  canOpenNotificationPage,
  notificationPages,
} from '@/config/notification-pages';
it('registers promotion suggestions and restricts access to tenant report/stock/product roles', () => {
  expect(
    notificationPages.some((p) => p.href === '/notifications/promotions')
  ).toBe(true);
  expect(
    canOpenNotificationPage('/notifications/promotions', 'tenant_staff', [])
  ).toBe(false);
  expect(
    canOpenNotificationPage('/notifications/promotions', 'tenant_owner')
  ).toBe(true);
  expect(
    canOpenNotificationPage('/notifications/promotions', 'super_admin')
  ).toBe(false);
});

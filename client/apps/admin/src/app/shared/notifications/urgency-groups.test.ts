import { it, expect } from 'vitest';
import { groupByUrgency } from './urgency-groups';
import type { TenantNotice } from '@/services/notification.service';
it('urgency view ranks stock cover then speed, while preserving read state', () => {
  const notice = (id: string, days: number, speed: number) =>
    ({
      _id: id,
      type: 'low_stock_alert',
      title: id,
      message: 'Stock running low',
      priority: 'high',
      createdAt: '2026-10-09',
      metadata: { daysOfCover: days, units30: speed },
      isRead: true,
    }) as TenantNotice;
  const groups = groupByUrgency([
    notice('slow', 30, 5),
    notice('fast', 10, 30),
  ]);
  expect(groups[0].items.map((n) => n._id)).toEqual(['fast', 'slow']);
  expect(groups[0].unread).toBe(0);
  expect(groups[0].label).toBe('High priority');
});

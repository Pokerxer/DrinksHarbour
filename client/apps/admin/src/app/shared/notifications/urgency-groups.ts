import type { TenantNotice } from '@/services/notification.service';
import type { NoticeGroup } from './inbox-filters';
export function groupByUrgency(notices: TenantNotice[]): NoticeGroup[] {
  const rank = ['urgent', 'high', 'normal', 'low'];
  const number = (n: TenantNotice, key: string, fallback: number) =>
    typeof n.metadata[key] === 'number' ? Number(n.metadata[key]) : fallback;
  return rank
    .map((priority, index) => {
      const items = notices
        .filter(
          (n) =>
            (rank.includes(n.priority) ? n.priority : 'normal') === priority
        )
        .sort(
          (a, b) =>
            number(a, 'daysOfCover', Infinity) -
              number(b, 'daysOfCover', Infinity) ||
            number(b, 'units30', 0) - number(a, 'units30', 0) ||
            Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
            a._id.localeCompare(b._id)
        );
      return {
        key: `priority-${priority}`,
        label: ['Urgent', 'High priority', 'Normal priority', 'Low priority'][
          index
        ],
        items,
        unread: items.filter((n) => !n.isRead).length,
      };
    })
    .filter((g) => g.items.length);
}

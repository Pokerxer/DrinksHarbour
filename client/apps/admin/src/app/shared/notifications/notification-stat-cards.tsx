import NotificationSummaryCards from './notification-summary-cards';
import {
  PiBell,
  PiEnvelopeSimple,
  PiWarning,
  PiArrowSquareOut,
} from 'react-icons/pi';
import type { TenantNotice } from '@/services/notification.service';
import { safeAction } from './inbox-filters';
export default function NotificationStatCards({
  notices,
  total,
  unread,
  active,
  onSelect,
  scoped = false,
}: {
  notices: TenantNotice[];
  total: number;
  scoped?: boolean;
  unread: number;
  active: string;
  onSelect: (value: string) => void;
}) {
  const stats = [
    { label: 'Total notices', value: total, Icon: PiBell },
    { label: 'Unread', value: unread, Icon: PiEnvelopeSimple },
    {
      label: 'Urgent',
      value: notices.filter((n) => n.priority === 'urgent').length,
      Icon: PiWarning,
    },
    {
      label: 'Actionable',
      value: notices.filter((n) => safeAction(n.actionUrl)).length,
      Icon: PiArrowSquareOut,
    },
  ];
  return (
    <NotificationSummaryCards
      active={active}
      onSelect={onSelect}
      cards={stats.map(({ label, value }) => ({
        label,
        value,
        valueId: label,
        detail:
          label === 'Total notices' || label === 'Unread'
            ? scoped
              ? 'In selected timeframe'
              : 'Across your inbox'
            : 'In loaded window',
      }))}
    />
  );
}

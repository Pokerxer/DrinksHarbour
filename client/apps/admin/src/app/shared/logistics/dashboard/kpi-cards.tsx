'use client';

import cn from '@core/utils/class-names';
import { Text, Title } from 'rizzui';
import {
  PiClockCountdownDuotone,
  PiCurrencyNgnDuotone,
  PiPackageDuotone,
  PiTruckDuotone,
  PiWarningDuotone,
  PiCheckCircleDuotone,
} from 'react-icons/pi';
import { durationFromHours, naira } from '../format';
import type { DashboardData } from '../types';

interface KpiCardsProps {
  data: DashboardData | null;
  loading?: boolean;
  className?: string;
}

export default function KpiCards({ data, loading, className }: KpiCardsProps) {
  const kpis = data?.kpis;

  const cards = [
    {
      key: 'awaiting',
      title: 'Awaiting dispatch',
      value: kpis ? String(kpis.awaitingDispatch) : '—',
      hint: 'Ready to go out',
      icon: <PiPackageDuotone className="h-6 w-6" />,
      tone: 'text-blue',
    },
    {
      key: 'out',
      title: 'Out for delivery',
      value: kpis ? String(kpis.outForDelivery) : '—',
      hint: kpis ? `${kpis.activeTrips} active trip${kpis.activeTrips === 1 ? '' : 's'}` : '',
      icon: <PiTruckDuotone className="h-6 w-6" />,
      tone: 'text-primary',
    },
    {
      key: 'delivered',
      title: 'Delivered today',
      value: kpis ? String(kpis.deliveredToday) : '—',
      hint: 'Since midnight',
      icon: <PiCheckCircleDuotone className="h-6 w-6" />,
      tone: 'text-green',
    },
    {
      key: 'late',
      title: 'Running late',
      value: kpis ? String(kpis.late) : '—',
      hint: 'Past promised window',
      icon: <PiWarningDuotone className="h-6 w-6" />,
      // The only card that earns alarm colour, and only when it is non-zero.
      tone: kpis && kpis.late > 0 ? 'text-red' : 'text-gray-500',
    },
    {
      key: 'avg',
      title: 'Avg delivery time',
      value: durationFromHours(kpis?.avgDeliveryHours ?? null),
      hint: kpis?.avgDeliverySampleSize
        ? `${kpis.avgDeliverySampleSize} in last 30d`
        : 'No deliveries yet',
      icon: <PiClockCountdownDuotone className="h-6 w-6" />,
      tone: 'text-orange',
    },
    {
      key: 'cod',
      title: 'Cash with riders',
      value: kpis ? naira(kpis.codOutstanding) : '—',
      hint: 'Collected, not settled',
      icon: <PiCurrencyNgnDuotone className="h-6 w-6" />,
      tone: kpis && kpis.codOutstanding > 0 ? 'text-orange' : 'text-gray-500',
    },
  ];

  return (
    <div className={cn('grid grid-cols-2 gap-4 @2xl:grid-cols-3 @6xl:grid-cols-6', className)}>
      {cards.map((card) => (
        <div
          key={card.key}
          className="rounded-lg border border-muted bg-gray-0 p-4 dark:bg-gray-50"
        >
          <div className={cn('mb-3', card.tone)}>{card.icon}</div>
          <Text className="text-xs text-gray-500">{card.title}</Text>
          <Title as="h3" className={cn('mt-1 text-xl font-semibold', loading && 'opacity-50')}>
            {card.value}
          </Title>
          {card.hint ? (
            <Text className="mt-1 text-xs text-gray-400">{card.hint}</Text>
          ) : null}
        </div>
      ))}
    </div>
  );
}

'use client';

// "Today at a glance" widget: today vs yesterday for orders and revenue.
// Data already arrives in StatCards (statCards.today / .yesterday) via the
// dashboard context — deliberately zero new fetches and zero new service
// surface. Reuses the shared widget-parts card language (MetricBox +
// DeltaBadge) so it reads as one family with the stat cards.
// RSC note: subpath rizzui imports only — never `from 'rizzui'`.

import WidgetCard from '@core/components/cards/widget-card';
import { PiSunHorizonDuotone } from 'react-icons/pi';
import { useDashboard } from './use-dashboard';
import {
  formatCompactNaira as fmt,
  percentChange as pct,
} from './dashboard-format';
import { DeltaBadge, EmptyState, MetricBox } from './widget-parts';

function SkeletonTile() {
  return (
    <div className="animate-pulse rounded-xl border border-muted bg-gray-50 px-3 py-2.5 dark:bg-gray-100/10">
      <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-100/20" />
      <div className="mt-2 h-5 w-16 rounded bg-gray-200 dark:bg-gray-100/20" />
      <div className="mt-2 h-4 w-20 rounded bg-gray-200 dark:bg-gray-100/20" />
    </div>
  );
}

export default function TodayMomentum({
  className,
}: {
  className?: string;
}) {
  const data = useDashboard();
  const today = data?.statCards.today;
  const yesterday = data?.statCards.yesterday;

  return (
    <WidgetCard
      title="Today at a glance"
      description="So far today, against the same time yesterday"
      descriptionClassName="mt-0.5 text-gray-500 dark:text-gray-600"
      className={className}
    >
      {!data || !today || !yesterday ? (
        <div className="mt-4 grid grid-cols-1 gap-3 @sm:grid-cols-2">
          <SkeletonTile />
          <SkeletonTile />
        </div>
      ) : (
        <MomentumTiles today={today} yesterday={yesterday} />
      )}
    </WidgetCard>
  );
}

type DayEdge = { orders: number; revenue: number };

function MomentumTiles({ today, yesterday }: { today: DayEdge; yesterday: DayEdge }) {
  // Just past midnight both edges can legitimately be zero — showing two
  // "–100%" deltas then reads like a failure. Say "new day" instead.
  // (Colour is never the only channel: the badge carries icon + signed %.)
  const isNewDay =
    today.orders === 0 &&
    today.revenue === 0 &&
    yesterday.orders === 0 &&
    yesterday.revenue === 0;

  if (isNewDay) {
    return (
      <EmptyState
        icon={<PiSunHorizonDuotone className="h-6 w-6" aria-hidden="true" />}
        message="New day — check back later"
        className="py-9"
      />
    );
  }

  const ordersPct = pct(today.orders, yesterday.orders);
  const revenuePct = pct(today.revenue, yesterday.revenue);

  return (
    // <dl> keeps the pair as a definition list for screen readers.
    <dl className="mt-4 grid grid-cols-1 gap-3 @sm:grid-cols-2">
      <MetricBox
        label="Orders today"
        value={today.orders.toLocaleString()}
        sub={
          <>
            <DeltaBadge
              up={ordersPct >= 0}
              percent={Math.abs(ordersPct)}
              ariaLabel={`${ordersPct >= 0 ? 'Up' : 'Down'} ${Math.abs(ordersPct)}% vs yesterday`}
            />
            <span>Orders vs yesterday</span>
          </>
        }
      />
      <MetricBox
        label="Revenue today"
        value={fmt(today.revenue)}
        color="text-[#10b981] dark:text-green-400"
        sub={
          <>
            <DeltaBadge
              up={revenuePct >= 0}
              percent={Math.abs(revenuePct)}
              ariaLabel={`${revenuePct >= 0 ? 'Up' : 'Down'} ${Math.abs(revenuePct)}% vs yesterday`}
            />
            <span>Revenue vs yesterday</span>
          </>
        }
      />
    </dl>
  );
}

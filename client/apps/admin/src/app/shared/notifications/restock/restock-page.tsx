'use client';
import NotificationTimeframe from '../notification-timeframe';
import { useInsightPlan } from '../insights/use-insight-plan';
import InsightShell from '../insights/insight-shell';
import { usePlanningFilters } from '../insights/insight-controls';
import RestockResults from './restock-results';
export default function RestockPage({
  vendorOrders = false,
}: {
  vendorOrders?: boolean;
}) {
  const filters = usePlanningFilters(),
    inbox = useInsightPlan('order-plan', filters.query);
  return (
    <InsightShell
      title={vendorOrders ? 'Vendor order plans' : 'Restock recommendations'}
      description={
        vendorOrders
          ? 'Group the quantities you need by supplier, currency and receiving warehouse. Review each purchase before saving.'
          : 'Choose stock cover, compare supplier delivery times and review recommended units and packs based on past sales.'
      }
      plan={inbox.data}
      loading={inbox.loading}
      error={inbox.error}
      refresh={inbox.refresh}
      warehouse={
        inbox.data?.warehouses.find((w) => w._id === filters.warehouseId)?.name
      }
    >
      <NotificationTimeframe
        completed
        startDate={filters.startDate}
        endDate={filters.endDate}
        onApply={(start, end) => filters.setRange?.(start, end)}
        disabled={inbox.loading}
      />
      {filters.startDate && (
        <p className="text-xs text-gray-500">
          Sales sorting uses the selected timeframe. Stock, forecasts and
          restock recommendations show current needs.
        </p>
      )}
      {inbox.data && !inbox.data.canPurchase && !inbox.loading && (
        <p className="rounded-xl border bg-white p-6 text-sm text-gray-600">
          Purchasing access is required to review restock orders.
        </p>
      )}
      {inbox.data?.canPurchase && (
        <RestockResults
          key={`${inbox.scope}:${inbox.data.generatedAt}`}
          plan={inbox.data}
          vendorOrders={vendorOrders}
          loading={inbox.loading}
          filters={filters}
          refresh={inbox.refresh}
        />
      )}
    </InsightShell>
  );
}

'use client';

import {
  EmptyChart,
  ChartCard,
  DonutChart,
  StockFlowChart,
  TopProductsChart,
  type FlowPoint,
  type SlicePoint,
  type TopProductPoint,
} from './inventory-dashboard-charts';

interface ChartSectionProps {
  flowData: FlowPoint[];
  healthSlices: SlicePoint[];
  warehouseSlices: SlicePoint[];
  topProducts: TopProductPoint[];
  loading: boolean;
  stockAvailable?: boolean;
  historyAvailable?: boolean;
}

function ChartSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 space-y-2">
        <div className="h-4 w-32 rounded bg-gray-200" />
        <div className="h-3 w-48 rounded bg-gray-200" />
      </div>
      <div className="flex items-center justify-center rounded-lg bg-gray-50/60" style={{ height }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-[#b20202]" />
      </div>
    </div>
  );
}

export default function ChartSection({
  flowData,
  healthSlices,
  warehouseSlices,
  topProducts,
  loading,
  stockAvailable = true,
  historyAvailable = true,
}: ChartSectionProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <div className="xl:col-span-3">
            <ChartSkeleton />
          </div>
          <div className="xl:col-span-2">
            <ChartSkeleton />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <div className="xl:col-span-2">
            <ChartSkeleton />
          </div>
          <div className="xl:col-span-3">
            <ChartSkeleton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <ChartCard
            title="Stock flow"
            subtitle="Incoming and outgoing units by UTC date in the selected history, including returns and losses; transfers are separate"
          >
            <>
              {historyAvailable ? (
                <StockFlowChart data={flowData} />
              ) : (
                <EmptyChart label="History unavailable — retry to load movements" />
              )}
            </>
          </ChartCard>
        </div>
        <div className="xl:col-span-2">
          <ChartCard
            title="Stock health"
            subtitle="Stock lines by status (from warehouse thresholds)"
          >
            <>
              {stockAvailable ? (
                <DonutChart data={healthSlices} />
              ) : (
                <EmptyChart label="Stock unavailable — retry to load balances" />
              )}
            </>
          </ChartCard>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <ChartCard title="Value by warehouse" subtitle="Stock value (cost basis) per location">
            <>
              {stockAvailable ? (
                <TopProductsChart data={warehouseSlices} />
              ) : (
                <EmptyChart label="Stock unavailable — retry to load balances" />
              )}
            </>
          </ChartCard>
        </div>
        <div className="xl:col-span-3">
          <ChartCard
            title="All products by stock value"
            subtitle="Every matching product, including zero and negative stock; scroll to see all"
          >
            <>
              {stockAvailable ? (
                <TopProductsChart data={topProducts} />
              ) : (
                <EmptyChart label="Stock unavailable — retry to load balances" />
              )}
            </>
          </ChartCard>
        </div>
      </div>
    </div>
  );
}

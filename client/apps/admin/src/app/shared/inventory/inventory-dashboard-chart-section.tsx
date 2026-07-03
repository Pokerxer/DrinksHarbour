'use client';

import {
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
}

function ChartSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 space-y-2">
        <div className="h-4 w-32 rounded bg-gray-200" />
        <div className="h-3 w-48 rounded bg-gray-200" />
      </div>
      <div
        className="flex items-center justify-center rounded-lg bg-gray-50/60"
        style={{ height }}
      >
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
            subtitle="Units received vs issued per day, last 14 days"
          >
            <StockFlowChart data={flowData} />
          </ChartCard>
        </div>
        <div className="xl:col-span-2">
          <ChartCard
            title="Stock health"
            subtitle="Stock lines by status (from warehouse thresholds)"
          >
            <DonutChart data={healthSlices} />
          </ChartCard>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <ChartCard
            title="Value by warehouse"
            subtitle="Stock value (cost basis) per location"
          >
            <DonutChart data={warehouseSlices} currency />
          </ChartCard>
        </div>
        <div className="xl:col-span-3">
          <ChartCard
            title="Top products by stock value"
            subtitle="Where your inventory capital sits"
          >
            <TopProductsChart data={topProducts} />
          </ChartCard>
        </div>
      </div>
    </div>
  );
}

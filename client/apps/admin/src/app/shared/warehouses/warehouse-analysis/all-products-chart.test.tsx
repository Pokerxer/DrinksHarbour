// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MainChart } from '../warehouse-analysis-charts';
import type { GroupRow } from '../warehouse-analysis-helpers';
vi.mock('recharts', () => {
  const Chart = ({ data }: { data: GroupRow[] }) => (
    <div>
      {data.map((r) => (
        <span key={r.label}>{r.label}</span>
      ))}
    </div>
  );
  const Container = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const Empty = () => null;
  return {
    BarChart: Chart,
    ComposedChart: Chart,
    ResponsiveContainer: Container,
    Bar: Empty,
    Line: Empty,
    PieChart: Empty,
    Pie: Empty,
    Cell: Empty,
    XAxis: Empty,
    YAxis: Empty,
    CartesianGrid: Empty,
    Tooltip: Empty,
    ReferenceLine: Empty,
    LabelList: Empty,
  };
});
afterEach(cleanup);
for (const chartType of ['bar', 'line'] as const)
  it(`shows every product in the ${chartType} chart, beyond 30 groups`, () => {
    const data = Array.from({ length: 45 }, (_, i) => ({
      label: `Product ${i + 1}`,
      isoKey: `${i}`,
      value: 10,
      orders: 1,
      orderList: [],
    }));
    render(
      <MainChart
        data={data}
        chartType={chartType}
        measure="on_hand_qty"
        groupLabel="Product"
        measureLabel="On hand"
        totalValue={450}
        totalOrders={45}
        onBarClick={() => {}}
      />,
    );
    expect(screen.getByText('Product 45')).toBeTruthy();
    expect(screen.getAllByText(/^Product \d+$/)).toHaveLength(45);
  });

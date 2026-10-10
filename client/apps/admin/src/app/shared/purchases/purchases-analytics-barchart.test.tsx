// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MainChart, StackedChart } from './purchases-analytics-charts';
import type { GroupRow } from './purchases-analytics-helpers';
const rows = (count: number): GroupRow[] =>
  Array.from({ length: count }, (_, i) => ({
    label: `Vendor ${i + 1}`,
    isoKey: `v${i + 1}`,
    value: (i + 1) * 1000,
    orders: i + 1,
    orderList: [],
  }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function assertFinite(container: HTMLElement) {
  for (const element of Array.from(container.querySelectorAll('*'))) {
    for (const attribute of Array.from(element.attributes))
      expect(attribute.value).not.toMatch(/NaN|Infinity/);
  }
}
function main(count: number, width = 800) {
  return render(
    <div style={{ width, height: 420 }}>
      <MainChart
        data={rows(count)}
        chartType="bar"
        measure="total_cost"
        groupLabel="Vendor"
        measureLabel="Total cost"
        totalValue={15000}
        totalOrders={count}
        onBarClick={() => {}}
      />
    </div>,
  );
}
describe('purchase bars include all products with finite geometry', () => {
  for (const count of [1, 2, 5, 8, 9, 10, 12, 20, 30, 45]) {
    it(`${count} groups retain every product and value label`, () => {
      const warnings = vi.spyOn(console, 'error');
      const { container } = main(count);
      assertFinite(container);
      expect(container.querySelectorAll('.bv-value-label')).toHaveLength(count);
      expect(container.textContent).toContain(`Vendor ${count}`);
      expect(warnings.mock.calls.flat().join(' ')).not.toMatch(/Received NaN/);
    });
  }
  it('collapsed containers retain finite geometry', () => {
    const { container } = main(20, 0);
    assertFinite(container);
  });
  it('stacked groups also render every product with finite geometry', () => {
    const warnings = vi.spyOn(console, 'error');
    const { container } = render(
      <StackedChart
        rows={rows(45).map((row) => ({ ...row, __total__: row.value, wine: row.value }))}
        series={['wine']}
        chartType="bar"
        measure="total_cost"
        groupLabel="Vendor"
        measureLabel="Total cost"
        orderMap={{}}
        onSegmentClick={() => {}}
      />,
    );
    assertFinite(container);
    expect(container.querySelectorAll('.bv-value-label')).toHaveLength(45);
    expect(container.textContent).toContain('Vendor 45');
    expect(warnings.mock.calls.flat().join(' ')).not.toMatch(/Received NaN/);
  });
});

// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MainChart, StackedChart } from '../warehouse-analysis-charts';
const data = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    label: `Product ${i + 1}`,
    isoKey: `${i}`,
    value: 10 + i,
    orders: 1,
    orderList: [],
  }));
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 1000,
    bottom: 500,
    width: 1000,
    height: 500,
    toJSON: () => ({}),
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private callback: ResizeObserverCallback) {}
      observe(target: Element) {
        this.callback(
          [{ target, contentRect: { width: 1000, height: 500 } }] as ResizeObserverEntry[],
          this as unknown as ResizeObserver,
        );
      }
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function chart(count: number) {
  return (
    <MainChart
      data={data(count)}
      chartType="bar"
      measure="on_hand_qty"
      groupLabel="Product"
      measureLabel="On hand"
      totalValue={1000}
      totalOrders={count}
      onBarClick={() => {}}
    />
  );
}
it('keeps readable horizontal rows and complete finite bars across 8, 9, 45 and 1 products', () => {
  const { container, rerender } = render(chart(8));
  for (const count of [8, 9, 45, 1]) {
    rerender(chart(count));
    const ticks = container.querySelector('.yAxis')?.textContent || '';
    expect(ticks).toContain(`Product${count}`);
    expect(container.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(count);
    expect(container.querySelector('svg')?.outerHTML).not.toMatch(/NaN|Infinity/);
  }
});
it('uses the same horizontal layout for stacked products below and above eight', () => {
  const stacked = (count: number) => (
    <StackedChart
      rows={data(count).map((row) => ({
        ...row,
        __total__: row.value,
        Main: row.value,
      }))}
      series={['Main']}
      chartType="bar"
      measure="on_hand_qty"
      groupLabel="Product"
      measureLabel="On hand"
      orderMap={{}}
      onSegmentClick={() => {}}
    />
  );
  const { container, rerender } = render(stacked(8));
  for (const count of [8, 9]) {
    rerender(stacked(count));
    expect(container.querySelector('.yAxis')?.textContent || '').toContain(`Product${count}`);
    expect(container.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(count);
    expect(container.querySelector('svg')?.outerHTML).not.toMatch(/NaN|Infinity/);
  }
});

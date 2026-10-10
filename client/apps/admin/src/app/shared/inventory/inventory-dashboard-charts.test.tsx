// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { TopProductsChart } from './inventory-dashboard-charts';
afterEach(cleanup);
it('shows all 45 products with full labels, zero and negative values', () => {
  const data = Array.from({ length: 45 }, (_, i) => ({
    id: String(i),
    name: `Product ${i} with its entire name`,
    value: i === 0 ? -12.5 : i,
  }));
  const { container } = render(<TopProductsChart data={data} />);
  expect(container.textContent).toContain('Product 44 with its entire name');
  expect(container.textContent).toContain('Product 0 with its entire name');
  expect(container.querySelectorAll('[data-stock-value]')).toHaveLength(45);
  expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
});
it('invalid values never produce invalid width or currency labels', () => {
  const { container } = render(
    <TopProductsChart
      data={[
        { name: 'Unavailable', value: NaN },
        { name: 'Free', value: 0 },
      ]}
    />,
  );
  expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
  expect(container.textContent).toContain('Free');
});
import ChartSection from './inventory-dashboard-chart-section';
it('failed feeds are explicitly unavailable rather than empty stock or zero history', () => {
  const { container } = render(
    <ChartSection
      flowData={[]}
      healthSlices={[]}
      warehouseSlices={[]}
      topProducts={[]}
      loading={false}
      stockAvailable={false}
      historyAvailable={false}
    />,
  );
  expect(container.textContent).toContain('History unavailable');
  expect(container.textContent).toContain('Stock unavailable');
  expect(container.textContent).not.toContain('No stock matches');
});

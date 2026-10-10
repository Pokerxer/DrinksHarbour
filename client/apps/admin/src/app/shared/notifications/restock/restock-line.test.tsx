// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { it, expect, vi, afterEach } from 'vitest';
import RestockLine from './restock-line';
import type {
  InsightLine,
  SupplierOffer,
} from '@/services/notificationInsights.service';
const offer = {
  offerId: 'o',
  vendorName: 'Supplier',
  currency: 'NGN',
  unitPrice: 2000,
  packagingQty: 12,
  minQuantity: 1,
  maxQuantity: null,
  quantity: 36,
  packs: 3,
  estimatedCost: 72000,
  daysOfCover: 10,
  leadTimeDays: 7,
  leadTimeSource: 'pricelist',
} as SupplierOffer;
const line = {
  key: 'p:s:w',
  subProductId: 'p',
  sizeId: 's',
  warehouseId: 'w',
  sku: 'D',
  productName: 'Drink',
  warehouseName: 'Main',
  sizeName: 'Bottle',
  selected: offer,
  alternatives: [
    offer,
    {
      ...offer,
      offerId: 'fast',
      vendorName: 'Fast',
      leadTimeDays: 2,
      quantity: 24,
    },
  ],
  limitations: [],
} as InsightLine;
afterEach(cleanup);
it('supplier switch uses that supplier calculated quantity', () => {
  const change = vi.fn();
  render(<RestockLine line={line} onChange={change} />);
  fireEvent.change(screen.getByLabelText('Supplier for Drink at Main'), {
    target: { value: 'fast' },
  });
  expect(change).toHaveBeenCalledWith({ offerId: 'fast', quantity: 24 });
});
it('invalid manual quantity cannot masquerade as an order total', () => {
  render(
    <RestockLine
      line={line}
      selection={{ offerId: 'o', quantity: 35 }}
      onChange={vi.fn()}
    />
  );
  expect(screen.getByRole('alert').textContent).toContain('whole packs');
  expect(screen.getByText('Review quantity')).toBeTruthy();
});
it('explains quantity timing and lets a reviewed edit reset or exclude the product', () => {
  function Review() {
    const [choice, setChoice] = React.useState<{
      offerId: string;
      quantity: number;
    }>();
    return (
      <RestockLine
        line={{
          ...line,
          selected: {
            ...offer,
            replenishment: {
              horizonDays: 21,
              forecastUnits: 42,
              safetyUnits: 4,
              minimumTargetUnits: 19,
              availableAfterCommitments: 10,
              incomingUnits: 0,
              excludedIncomingUnits: 0,
              balanceAtDelivery: -4,
              projectedEndingUnits: -32,
              shortfallBeforeDelivery: 4,
              deliveryDate: '2026-10-16T10:00:00Z',
            },
          },
        }}
        selection={choice}
        onChange={setChoice}
      />
    );
  }
  render(<Review />);
  expect(screen.getByText(/before the supplier can arrive/i)).toBeTruthy();
  expect(screen.getByText('Demand through delivery + cover')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Order units for Drink at Main'), {
    target: { value: '24' },
  });
  expect(
    (screen.getByLabelText('Order units for Drink at Main') as HTMLInputElement)
      .value
  ).toBe('24');
  fireEvent.click(
    screen.getByRole('button', { name: 'Use suggested quantity' })
  );
  expect(
    (screen.getByLabelText('Order units for Drink at Main') as HTMLInputElement)
      .value
  ).toBe('36');
  fireEvent.click(screen.getByRole('button', { name: 'Exclude from order' }));
  expect(
    (screen.getByLabelText('Order units for Drink at Main') as HTMLInputElement)
      .value
  ).toBe('0');
  expect(
    screen
      .getByRole('link', { name: /Review warehouse supply/ })
      .getAttribute('href')
  ).toContain('warehouseId=w');
});
it('a retained supplier tier explains manual review and does not offer an automatic reset', () => {
  render(
    <RestockLine
      line={{
        ...line,
        selected: {
          ...offer,
          quantity: 0,
          needsManualReview: true,
          manualReviewReason: 'Required units exceed supplier maximum.',
        },
      }}
      onChange={vi.fn()}
    />
  );
  expect(
    screen.getByText(/Required units exceed supplier maximum/)
  ).toBeTruthy();
  expect(
    screen.queryByRole('button', { name: 'Use suggested quantity' })
  ).toBeNull();
});
it('restricted views hide demand and stock evidence even if an old row still contains it', () => {
  render(
    <RestockLine
      line={{
        ...line,
        available: 10,
        units30: 30,
        forecast: {
          method: 'historical_baseline',
          historyDays: 42,
          model: null,
          startDate: '2026-10-08T23:00:00Z',
          daily: Array(90).fill(1),
          demand7: 7,
          demand14: 14,
          demand30: 30,
          errors: null,
          limitations: [],
        },
      }}
      stock={false}
      demand={false}
      onChange={vi.fn()}
    />
  );
  expect(screen.queryByText('Recorded history')).toBeNull();
  expect(screen.queryByText('Available / alert threshold')).toBeNull();
  expect(screen.queryByRole('link')).toBeNull();
  expect(
    screen.queryByRole('button', { name: 'Use suggested quantity' })
  ).toBeNull();
});
it('a missing price match is explained separately from missing demand history', () => {
  render(
    <RestockLine
      line={{
        ...line,
        alternatives: [],
        selected: null,
        forecast: {
          method: 'insufficient_history',
          historyDays: 0,
          model: null,
          startDate: '2026-10-08T23:00:00Z',
          daily: [],
          demand7: null,
          demand14: null,
          demand30: null,
          errors: null,
          limitations: [],
        },
      }}
      onChange={vi.fn()}
    />
  );
  expect(screen.getByText(/No current supplier price matches/)).toBeTruthy();
  expect(screen.getByText(/forecast also needs complete/i)).toBeTruthy();
});

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
it('unavailable forecast explains cover and does not claim supply extends beyond a horizon', () => {
  render(
    <RestockLine
      line={{
        ...line,
        selected: {
          ...offer,
          daysOfCover: null,
          needsManualReview: true,
          manualReviewReason: 'Review transfers.',
          replenishment: {
            horizonDays: 21,
            deliveryDate: null,
            availableAfterCommitments: 0,
            forecastUnits: null,
            safetyUnits: 0,
            minimumTargetUnits: 0,
            incomingUnits: 0,
            excludedIncomingUnits: 0,
            balanceAtDelivery: null,
            projectedEndingUnits: null,
            shortfallBeforeDelivery: null,
            manualReviewReason:
              'Complete demand history must support the supplier delivery plus stock-cover horizon.',
          },
        },
      }}
      onChange={vi.fn()}
    />
  );
  expect(screen.queryByText(/Beyond forecast horizon/)).toBeNull();
  expect(screen.getByText(/Complete demand history must support/)).toBeTruthy();
  expect(screen.getByText(/Stock cover unavailable/)).toBeTruthy();
});
it('reviewed quantities update the projected ending balance and extra order units', () => {
  const selected = {
    ...offer,
    suggestedUnits: 30,
    replenishment: {
      horizonDays: 21,
      deliveryDate: null,
      availableAfterCommitments: 10,
      forecastUnits: 40,
      safetyUnits: 2,
      minimumTargetUnits: 3,
      incomingUnits: 0,
      excludedIncomingUnits: 0,
      balanceAtDelivery: 3,
      projectedEndingUnits: -30,
      shortfallBeforeDelivery: 0,
    },
  };
  render(
    <RestockLine
      line={{ ...line, selected, alternatives: [selected] }}
      selection={{ offerId: 'o', quantity: 48 }}
      onChange={vi.fn()}
    />
  );
  expect(
    screen.getByText('Ending balance after reviewed order').nextElementSibling
      ?.textContent
  ).toBe('18 units');
  expect(
    screen.getByText('Units above forecast requirement').nextElementSibling
      ?.textContent
  ).toBe('18 units');
});
it('clearing the supplier removes its quantity controls and order selection', () => {
  function Review() {
    const [choice, setChoice] = React.useState<{
      offerId: string;
      quantity: number;
    }>();
    return <RestockLine line={line} selection={choice} onChange={setChoice} />;
  }
  render(<Review />);
  fireEvent.change(screen.getByLabelText('Supplier for Drink at Main'), {
    target: { value: '' },
  });
  expect(screen.queryByLabelText('Order units for Drink at Main')).toBeNull();
});

it('pack controls respect supplier minimum, maximum and exclusion', () => {
  const selected = { ...offer, minQuantity: 15, maxQuantity: 36, quantity: 0 };
  function Review() {
    const [choice, setChoice] = React.useState<{
      offerId: string;
      quantity: number;
    }>();
    return (
      <RestockLine
        line={{ ...line, selected, alternatives: [selected] }}
        selection={choice}
        onChange={setChoice}
      />
    );
  }
  render(<Review />);
  const input = () =>
    screen.getByLabelText('Order units for Drink at Main') as HTMLInputElement;
  fireEvent.click(screen.getByRole('button', { name: 'Add one pack' }));
  expect(input().value).toBe('24'); // two packs meet minimum 15
  fireEvent.click(screen.getByRole('button', { name: 'Add one pack' }));
  expect(input().value).toBe('36');
  expect(
    (screen.getByRole('button', { name: 'Add one pack' }) as HTMLButtonElement)
      .disabled
  ).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Remove one pack' }));
  expect(input().value).toBe('24');
  fireEvent.click(screen.getByRole('button', { name: 'Remove one pack' }));
  expect(input().value).toBe('0');
  fireEvent.change(input(), { target: { value: '' } });
  expect(input().getAttribute('aria-invalid')).toBe('true');
  expect(screen.getByText('Review quantity')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Add one pack' }));
  expect(input().value).toBe('24');
});

it('warehouse consumption explains sales and posted transfers without guessing missing demand', () => {
  render(
    <RestockLine
      line={{ ...line, units30: 0, transferUnits30: 30, demandUnits30: 30 }}
      embedded
      onChange={vi.fn()}
    />
  );
  expect(screen.getByText(/30 units transferred out/)).toBeTruthy();
  expect(screen.getByText(/30 units total warehouse demand/)).toBeTruthy();
});
it('shows post-delivery demand separately from missed sales and pack rounding', () => {
  const selected = {
    ...offer,
    quantity: 24,
    packs: 2,
    suggestedUnits: 16,
    replenishment: {
      horizonDays: 21,
      deliveryDate: null,
      forecastUnits: 21,
      forecastAfterDeliveryUnits: 14,
      availableAfterCommitments: 0,
      safetyUnits: 2,
      minimumTargetUnits: 2,
      incomingUnits: 0,
      excludedIncomingUnits: 0,
      balanceAtDelivery: 0,
      projectedEndingUnits: -14,
      shortfallBeforeDelivery: 7,
    },
  };
  render(
    <RestockLine
      line={{ ...line, selected, alternatives: [selected] }}
      onChange={vi.fn()}
    />
  );
  expect(
    screen.getByText('Forecast demand after delivery').nextElementSibling
      ?.textContent
  ).toBe('14 units');
  expect(
    screen.getByText(/Missed sales before delivery are excluded/)
  ).toBeTruthy();
});

it('a smaller reviewed order reports the remaining requirement rather than hiding the deficit', () => {
  const selected = { ...offer, suggestedUnits: 30 };
  render(
    <RestockLine
      line={{ ...line, selected, alternatives: [selected] }}
      selection={{ offerId: 'o', quantity: 24 }}
      onChange={vi.fn()}
    />
  );
  expect(
    screen.getByText(/6 units below the calculated requirement/)
  ).toBeTruthy();
});

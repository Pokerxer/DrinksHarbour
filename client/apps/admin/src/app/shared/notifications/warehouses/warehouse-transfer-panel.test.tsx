// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { expect, it, vi, afterEach } from 'vitest';
import WarehouseTransferPanel from './warehouse-transfer-panel';
import type { WarehouseTransferPlan } from '@/services/notificationInsights.service';
vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.ComponentProps<'a'>) => (
    <a {...props}>{children}</a>
  ),
}));
afterEach(cleanup);
const plan: WarehouseTransferPlan = {
  basis: 'configured_minimum',
  nextStep: 'transfer_review',
  needUnits: 11,
  pendingUnits: 0,
  additionalUnits: 11,
  uncoveredUnits: 0,
  outboundUnits: 0,
  protectedUnits: 10,
  availableAfterCommitments: 0,
  pending: [],
  usualSources: [],
  sources: [
    {
      sourceWarehouseId: 'a'.repeat(24),
      sourceWarehouseName: 'Central hub',
      deliveries: 3,
      netUnits: 30,
      lastReceivedAt: '2026-10-08',
      typicalTransitDays: 1,
      usualSource: true,
      safeSurplus: 40,
      recommendedUnits: 11,
      protectedUnits: 10,
      outboundUnits: 5,
      needsManualReview: true,
    },
  ],
};
it('explains the usual source and reserve, and prepares an exact editable transfer', () => {
  render(
    <WarehouseTransferPanel
      plan={plan}
      productId={'b'.repeat(24)}
      sizeId={'c'.repeat(24)}
      destinationId={'d'.repeat(24)}
      manage
      coverDays={14}
    />
  );
  expect(screen.getByText(/Central hub/)).toBeTruthy();
  expect(screen.getByText(/Usual source/)).toBeTruthy();
  const link = screen.getByRole('link', { name: /Prepare transfer/ });
  expect(link.getAttribute('href')).toContain('quantity=11');
  expect(link.getAttribute('href')).toContain(
    'destinationWarehouseId=' + 'd'.repeat(24)
  );
  expect(screen.getByText(/Minimum-stock guidance/)).toBeTruthy();
});
it('pending coverage still requests arrival confirmation and avoids claiming stock is replenished', () => {
  const pending = {
    ...plan,
    nextStep: 'follow_up' as const,
    pendingUnits: 15,
    additionalUnits: 0,
    sources: [],
    pending: [
      {
        transferId: 'e'.repeat(24),
        reference: 'TR-123',
        status: 'in_transit',
        sourceWarehouseId: 'a'.repeat(24),
        sourceWarehouseName: 'Central hub',
        quantity: 15,
        arrival: null,
        followUpReason: 'Confirm arrival and record receipt',
      },
    ],
  };
  render(
    <WarehouseTransferPanel
      plan={pending}
      productId="p"
      sizeId="s"
      destinationId="d"
      manage={false}
      coverDays={14}
    />
  );
  expect(screen.getByText(/Confirm arrival and record receipt/)).toBeTruthy();
  expect(screen.queryByRole('link')).toBeNull();
  expect(screen.getByText(/Arrival unconfirmed/)).toBeTruthy();
});
it('source approval intent shows its destination and review action even with no committed quantity', () => {
  render(
    <WarehouseTransferPanel
      plan={{
        ...plan,
        nextStep: 'monitor',
        sources: [],
        outboundUnits: 0,
        outgoing: [
          {
            transferId: 'tr',
            reference: 'TR-OUT',
            status: 'pending_approval',
            sourceWarehouseId: 'hub',
            sourceWarehouseName: 'Hub',
            destinationWarehouseName: 'Shop',
            quantity: 10,
            arrival: null,
            followUpReason: 'Approval needed',
          },
        ],
      }}
      productId="p"
      sizeId="s"
      destinationId="hub"
      manage
      coverDays={14}
    />
  );
  expect(screen.getByText(/TR-OUT.*Shop/)).toBeTruthy();
  expect(
    screen.getByRole('link', { name: /Review approval/ }).getAttribute('href')
  ).toBe('/purchases/transfers/tr');
});

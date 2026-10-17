// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import PaymentStatusBadge from './payment-status-badge';
import { DocumentDue } from './accounting-document-row';
afterEach(cleanup);
it('does not label a cancelled invoice as settled', () => {
  render(
    <DocumentDue
      doc={{
        _id: 'invoice',
        date: '2026-10-14',
        total: 100,
        amountPaid: 100,
        outstanding: 0,
        paymentStatus: 'paid',
        state: 'cancelled',
      }}
    />
  );
  expect(screen.getByText('No payment due')).toBeTruthy();
  expect(screen.queryByText('Settled')).toBeNull();
});
it.each([
  ['paid', 'Paid'],
  ['partial', 'Partially paid'],
  ['unpaid', 'Unpaid'],
])('labels %s payments explicitly', (status, label) => {
  render(<PaymentStatusBadge status={status} />);
  expect(screen.getByText(label)).toBeTruthy();
});
it('shows payment closed for a cancelled invoice even if its previous payment state was paid', () => {
  render(<PaymentStatusBadge status="paid" closed />);
  expect(screen.getByText('Payment closed')).toBeTruthy();
  expect(screen.queryByText('Paid')).toBeNull();
});

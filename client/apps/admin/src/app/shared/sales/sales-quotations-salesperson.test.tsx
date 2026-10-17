// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import SalesListKanban from './sales-list-kanban';
import type { SalesOrder } from '@/services/salesOrder.service';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(cleanup);
it('quotation board displays the saved salesperson assignment', () => {
  const order: SalesOrder = {
    _id: 'quotation',
    soNumber: 'SO00001',
    docType: 'quotation',
    quoteStatus: 'draft',
    salesperson: 'Ada Obi',
    salespersonUser: 'staff-id',
    items: [],
    currency: 'NGN',
    subtotal: 0,
    discountTotal: 0,
    taxTotal: 0,
    total: 0,
    fulfillments: [],
    createdAt: '2026-10-16T00:00:00Z',
  };
  render(<SalesListKanban isQuotation orders={[order]} />);
  expect(screen.getByText('Salesperson: Ada Obi')).toBeTruthy();
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import InvoiceCreateDetails from './invoice-create-details';
import InvoiceCreateReview from './invoice-create-review';
import SalesCustomerBar from '@/app/shared/sales/sales-customer-bar';
afterEach(cleanup);
it('keeps the chosen due date editable without presenting it as a quotation expiry', () => {
  const onDueDate = vi.fn();
  render(
    <SalesCustomerBar
      token="token"
      customer={null}
      onSelectCustomer={vi.fn()}
      onClearCustomer={vi.fn()}
      pricelists={[]}
      pricelistId=""
      onPricelistChange={vi.fn()}
      validUntil=""
      onValidUntilChange={vi.fn()}
      warehouses={[]}
      warehouseId=""
      onWarehouseChange={vi.fn()}
      invoiceDetails={
        <InvoiceCreateDetails
          dueDate="2026-10-20"
          onDueDate={onDueDate}
          disabled={false}
        />
      }
    />
  );
  const input = screen.getByLabelText(/Payment due date/);
  expect((input as HTMLInputElement).value).toBe('2026-10-20');
  fireEvent.change(input, { target: { value: '2026-10-25' } });
  expect(onDueDate).toHaveBeenCalledWith('2026-10-25');
  expect(screen.queryByText('Expiration')).toBeNull();
  expect(screen.queryByText('Quotation Date')).toBeNull();
});
it('preserves quotation dates in the normal sales editor', () => {
  render(
    <SalesCustomerBar
      token="token"
      customer={null}
      onSelectCustomer={vi.fn()}
      onClearCustomer={vi.fn()}
      pricelists={[]}
      pricelistId=""
      onPricelistChange={vi.fn()}
      validUntil="2026-10-25"
      onValidUntilChange={vi.fn()}
      warehouses={[]}
      warehouseId=""
      onWarehouseChange={vi.fn()}
    />
  );
  expect(screen.getByText('Quotation Date')).toBeTruthy();
  expect(screen.getByText('Expiration')).toBeTruthy();
});
it('shows the total, customer and product count without initiating a payment', () => {
  render(
    <InvoiceCreateReview
      customer="Ada Obi"
      dueDate="2026-10-20"
      productCount={2}
      subtotal={200}
      discounts={20}
      tax={5}
      shipping={5}
      total={190}
      currency="NGN"
      issueError=""
    />
  );
  expect(screen.getByText(/190/)).toBeTruthy();
  expect(screen.getByText('Ada Obi')).toBeTruthy();
  expect(screen.getByText('2')).toBeTruthy();
  expect(screen.getByText(/Ready to issue/)).toBeTruthy();
  expect(screen.getByText(/No payment is collected/)).toBeTruthy();
});

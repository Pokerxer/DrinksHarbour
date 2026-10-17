// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import SalesLineTable, { type PricedLine } from './sales-line-table';
import { blankLine } from './sales-create-pricing-helpers';
import SalesTotals from './sales-totals';
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));
afterEach(cleanup);
function Lines() {
  const [lines, setLines] = useState<PricedLine[]>([
    {
      ...blankLine(),
      key: 'p',
      subProductId: 'sp',
      name: 'Wine',
      quantity: 4,
      unitPrice: 100,
      baseUnitPrice: 100,
      discount: 40,
      lineTotal: 360,
      taxAmount: 0,
    },
  ]);
  return (
    <SalesLineTable
      token=""
      lines={lines}
      onUpdate={(key, patch) =>
        setLines((rows) =>
          rows.map((row) => (row.key === key ? { ...row, ...patch } : row)),
        )
      }
      onAdd={() => {}}
      onAddSection={() =>
        setLines((rows) => [
          ...rows,
          {
            ...blankLine('section'),
            key: 's',
            unitPrice: 0,
            lineTotal: 0,
            taxAmount: 0,
          },
        ])
      }
      onAddNote={() =>
        setLines((rows) => [
          ...rows,
          {
            ...blankLine('note'),
            key: 'n',
            unitPrice: 0,
            lineTotal: 0,
            taxAmount: 0,
          },
        ])
      }
      onRemove={(key) =>
        setLines((rows) => rows.filter((row) => row.key !== key))
      }
      onReorder={() => {}}
      onOpenCatalog={() => {}}
      onOpenScan={() => {}}
    />
  );
}
it('discount type selection preserves the amount off the whole line', () => {
  render(<Lines />);
  const toggle = screen.getByRole('button', { name: 'Discount type for Wine' });
  expect(toggle.textContent).toBe('₦');
  fireEvent.click(toggle);
  expect(toggle.textContent).toBe('%');
  expect(
    (screen.getByTitle('Line discount for Wine') as HTMLInputElement).value,
  ).toBe('10');
  fireEvent.click(toggle);
  expect(toggle.textContent).toBe('₦');
  expect(
    (screen.getByTitle('Line discount for Wine') as HTMLInputElement).value,
  ).toBe('40');
});
it('description, section and note are distinct multiline editing controls', () => {
  render(<Lines />);
  const description = screen.getByLabelText('Description for Wine');
  expect(description.tagName).toBe('TEXTAREA');
  fireEvent.change(description, {
    target: { value: 'Red wine\nServe chilled' },
  });
  expect((description as HTMLTextAreaElement).value).toContain('\n');
  fireEvent.click(screen.getByText('Add a section'));
  expect(screen.getByLabelText('Section title')).toBe(document.activeElement);
  fireEvent.change(screen.getByLabelText('Section title'), {
    target: { value: 'Reception' },
  });
  fireEvent.click(screen.getByText('Add a note'));
  expect(screen.getByLabelText('Note text').tagName).toBe('TEXTAREA');
  fireEvent.click(screen.getByRole('button', { name: 'Remove section' }));
  expect(screen.getByText('Wine')).toBeTruthy();
});
it('shipping validates input, pre-fills its amount and can be removed explicitly', () => {
  const shipping = vi.fn();
  render(
    <SalesTotals
      untaxedAmount={100}
      taxTotal={0}
      grandTotal={112.5}
      shippingFee={12.5}
      onShippingChange={shipping}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Edit shipping' }));
  const input = screen.getByLabelText('Shipping amount');
  expect((input as HTMLInputElement).value).toBe('12.5');
  fireEvent.change(input, { target: { value: '-1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply shipping' }));
  expect(shipping).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toBeTruthy();
  fireEvent.change(input, { target: { value: '18.75' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply shipping' }));
  expect(shipping).toHaveBeenCalledWith(18.75);
  fireEvent.click(screen.getByRole('button', { name: 'Remove shipping' }));
  expect(shipping).toHaveBeenLastCalledWith(0);
});
it('bulk discount explains replacement and refuses invalid percentages', () => {
  const discount = vi.fn();
  render(
    <SalesTotals
      untaxedAmount={100}
      taxTotal={0}
      grandTotal={100}
      onApplyDiscount={discount}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Discount' }));
  expect(
    screen.getByText(/replaces existing product-line discounts/i),
  ).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Discount on all product lines (%)'), {
    target: { value: '101' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply discount' }));
  expect(discount).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Discount on all product lines (%)'), {
    target: { value: '0' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply discount' }));
  expect(discount).toHaveBeenCalledWith(0);
});
it('failed coupon leaves the code and panel available for a corrected retry', async () => {
  const coupon = vi.fn().mockRejectedValue(new Error('Coupon expired'));
  render(
    <SalesTotals
      untaxedAmount={100}
      taxTotal={0}
      grandTotal={100}
      onApplyCoupon={coupon}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Coupon Code' }));
  fireEvent.change(screen.getByLabelText('Coupon code'), {
    target: { value: 'old' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply coupon' }));
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    'Coupon expired',
  );
  expect((screen.getByLabelText('Coupon code') as HTMLInputElement).value).toBe(
    'old',
  );
});
it('tax and resolved-discount labels use the supplied priced snapshot', async () => {
  const { default: Inputs } = await import('./sales-line-inputs');
  render(
    <table>
      <tbody>
        <tr>
          <Inputs
            line={{
              ...blankLine(),
              key: 'saved',
              name: 'Wine',
              quantity: 4,
              unitPrice: 100,
              discount: 10,
              discountType: 'percentage',
              lineTotal: 365,
              taxRate: 7.5,
              taxAmount: 1.23,
            }}
            onUpdate={() => {}}
          />
        </tr>
      </tbody>
    </table>,
  );
  expect(screen.getByText('₦1.23 tax')).toBeTruthy();
  expect(screen.getByText('−₦35.00')).toBeTruthy();
});

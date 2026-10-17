// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import SalesCreateHeader from './sales-create-header';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(cleanup);
it('shows distinct draft, print and confirmation states', () => {
  render(
    <SalesCreateHeader
      mode="create"
      saving={false}
      hasLines
      token="token"
      action="printing"
      onManualSave={vi.fn()}
      onPrint={vi.fn()}
      onCreateOrder={vi.fn()}
    />
  );
  expect(
    screen.getByRole('heading', { name: 'Create quotation' })
  ).toBeTruthy();
  expect(
    (screen.getByRole('button', { name: 'Save draft' }) as HTMLButtonElement)
      .disabled
  ).toBe(true);
  expect(screen.getByRole('button', { name: /Preparing print/ })).toBeTruthy();
  expect(
    (screen.getByRole('button', { name: 'Confirm order' }) as HTMLButtonElement)
      .disabled
  ).toBe(true);
});

it('locked edit is read-only and its navigation link is not a cancellation action', () => {
  render(<SalesCreateHeader mode="edit" initial={{_id:'sale',soNumber:'SO1',docType:'order',orderStatus:'draft',locked:true} as import('@/services/salesOrder.service').SalesOrder} readOnly saving={false} hasLines token="token" />);
  expect(screen.queryByRole('button',{name:'Save changes'})).toBeNull();
  expect(screen.queryByRole('button',{name:'Save draft'})).toBeNull();
  expect(screen.getByRole('link',{name:'Back to order'}).getAttribute('href')).toBe('/sales/sale');
  expect(screen.getByRole('status').textContent).toContain('Locked');
  fireEvent.click(screen.getByRole('button',{name:'More actions'}));
  expect((screen.getByRole('button',{name:'Duplicate'}) as HTMLButtonElement).disabled).toBe(false);
  expect(screen.queryByRole('button',{name:'Mark Quotation as Sent'})).toBeNull();
});

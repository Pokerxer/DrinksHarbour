// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import CustomerSearch from './customer-search';
import { posApi } from '@/app/shared/point-of-sale/api';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('a customer suggestion can be selected using Enter', async () => {
  const customer = {
    _id: 'customer',
    firstName: 'Ada',
    lastName: 'Bello',
    email: 'ada@example.com',
  };
  vi.spyOn(posApi, 'searchCustomers').mockResolvedValue({
    customers: [customer],
  } as never);
  const select = vi.fn();
  render(
    <CustomerSearch
      token="token"
      selected={null}
      onSelect={select}
      onClear={vi.fn()}
    />
  );
  fireEvent.focus(screen.getByRole('textbox', { name: 'Customer' }));
  const choice = await screen.findByRole('button', { name: /Ada Bello/ });
  fireEvent.keyDown(choice, { key: 'Enter' });
  expect(select).toHaveBeenCalledWith(customer);
});

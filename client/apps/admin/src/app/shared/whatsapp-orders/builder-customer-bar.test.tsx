// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import BuilderCustomerBar, { type CustomerDraft } from './builder-customer-bar';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('offers to save an unmatched phone and selects the saved loyalty profile', async () => {
  const customer = {
    _id: 'customer',
    firstName: 'Ada',
    lastName: 'Obi',
    email: 'ada@example.test',
    phone: '08012345678',
    loyaltyPoints: 42,
    loyaltyTier: 'cork',
  };
  const fetcher = vi.fn(
    async (_url: string, init: RequestInit) =>
      new Response(
        JSON.stringify({
          success: true,
          data: init.method === 'POST' ? { customer } : { customers: [] },
        })
      )
  );
  vi.stubGlobal('fetch', fetcher);
  function Builder() {
    const [value, setValue] = useState<CustomerDraft>({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
    });
    return (
      <BuilderCustomerBar token="admin" value={value} onChange={setValue} />
    );
  }
  render(<Builder />);
  const input = screen.getByRole('combobox', { name: 'Search customers' });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: customer.phone } });
  fireEvent.mouseDown(
    await screen.findByRole('option', { name: 'Add customer' }),
    { button: 0 }
  );
  expect(
    (screen.getByLabelText('WhatsApp phone') as HTMLInputElement).value
  ).toBe(customer.phone);
  fireEvent.change(screen.getByLabelText('First name'), {
    target: { value: customer.firstName },
  });
  fireEvent.change(screen.getByLabelText('Last name'), {
    target: { value: customer.lastName },
  });
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: customer.email },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save customer' }));
  expect(await screen.findByText(/42 loyalty points/)).toBeTruthy();
  expect(
    fetcher.mock.calls.some(
      ([url]) => new URL(url).searchParams.get('search') === customer.phone
    )
  ).toBe(true);
  const request = fetcher.mock.calls.find(
    ([, init]) => init.method === 'POST'
  )?.[1];
  expect(JSON.parse(String(request?.body))).toMatchObject({
    email: customer.email,
    phone: customer.phone,
  });
});

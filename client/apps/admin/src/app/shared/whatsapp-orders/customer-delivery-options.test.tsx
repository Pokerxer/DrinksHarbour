// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import BuilderCustomerBar from './builder-customer-bar';
import CustomerDeliveryOptions from './customer-delivery-options';
import useCustomerContext from './use-customer-context';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('refreshes draft loyalty and only applies a destination when an operator selects it', async () => {
  const profile = {
    _id: 'ada',
    firstName: 'Ada',
    lastName: 'Obi',
    email: 'ada@example.test',
    phone: '08012345678',
    loyaltyPoints: 84,
    loyaltyTier: 'barrel',
  };
  const address = {
    id: 'office',
    label: 'Office',
    address: '1 Example Street',
    lga: 'Ikeja',
    state: 'Lagos',
    zipCode: '',
    country: 'Nigeria',
    pin: { lat: 6.6, lon: 3.4 },
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      expect(new URL(url).pathname).toBe('/api/whatsapp-orders/customers/ada');
      return new Response(
        JSON.stringify({
          success: true,
          data: { customer: profile, addresses: [address] },
        })
      );
    })
  );
  const apply = vi.fn();
  function Draft() {
    const details = useCustomerContext('admin', profile._id);
    return (
      <>
        <BuilderCustomerBar
          token="admin"
          value={{ ...profile, loyaltyPoints: 5, loyaltyTier: 'cork' }}
          onChange={vi.fn()}
          liveLoyalty={details.context?.customer}
        />
        <CustomerDeliveryOptions customer={details} onApply={apply} />
      </>
    );
  }
  render(<Draft />);
  expect(await screen.findByText(/84 loyalty points/)).toBeTruthy();
  expect(apply).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Reuse a delivery address'), {
    target: { value: address.id },
  });
  expect(apply).toHaveBeenCalledWith({
    address: address.address,
    state: 'Lagos',
    lga: 'Ikeja',
    zipCode: '',
    country: 'Nigeria',
    pin: address.pin,
  });
});

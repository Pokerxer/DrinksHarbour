// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import useDeliveryQuote from './use-delivery-quote';
import type { DeliveryDraft } from './delivery-card';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('prices the pinned route and keeps the explicit fee until returned to calculated pricing', async () => {
  const fetchQuote = vi.fn(async (url: string) => {
    const query = new URL(url).searchParams;
    const hasPin = query.has('lat');
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          baseFee: hasPin ? 4300 : 2500,
          fee: 0,
          source: hasPin ? 'google' : 'zone',
          distanceKm: hasPin ? 14 : undefined,
        },
      })
    );
  });
  vi.stubGlobal('fetch', fetchQuote);
  const draft: DeliveryDraft = {
    address: 'Customer street',
    lga: 'Ikeja',
    state: 'Lagos',
    zipCode: '',
    country: 'Nigeria',
    pin: { lat: 6.6, lon: 3.4 },
  };
  const { result, rerender } = renderHook(
    ({ delivery }: { delivery: DeliveryDraft }) =>
      useDeliveryQuote(delivery, 40000, ['b', 'a', 'a']),
    { initialProps: { delivery: draft } }
  );
  expect(result.current.hasFee).toBe(false);
  await waitFor(() => expect(result.current.fee).toBe(4300));
  const query = new URL(fetchQuote.mock.calls[0][0]).searchParams;
  expect(Object.fromEntries(query)).toMatchObject({
    lat: '6.6',
    lon: '3.4',
    vendors: 'a,b',
    subtotal: '40000',
  });
  expect(result.current.info?.distanceKm).toBe(14);

  rerender({ delivery: { ...draft, pin: undefined, feeOverride: '0' } });
  expect(result.current.hasFee).toBe(true);
  expect(result.current.fee).toBe(0);
  await waitFor(() => expect(result.current.baseFee).toBe(2500));
  expect(result.current.fee).toBe(0);
  rerender({ delivery: { ...draft, pin: undefined } });
  expect(result.current.fee).toBe(2500);
});

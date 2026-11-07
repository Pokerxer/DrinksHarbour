// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import VenueCheckout from './venue-checkout';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
test('received_but_unsettled_funds_never_offer_a_second_payment', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: { sessionId: 'visit', orderId: 'bill', version: 4, lineVersion: 1, state: 'receipt_verified', quoteId: 'quote', currency: 'NGN', totalMinor: 100000, commissionMinor: 0, taxMinor: 0, lines: [], supportedTenders: ['paystack'], outstandingMinor: 100000 } }) })));
  render(<VenueCheckout token="token" sessionId="visit" />);
  expect(await screen.findByText(/funds received/i)).toBeTruthy();
  expect(screen.queryByRole('button', { name: /pay with paystack/i })).toBeNull();
  expect(screen.getByRole('button', { name: /check payment/i })).toBeTruthy();
});

test('freeze_uses_server_versions_and_explicit_age_confirmation', async () => {
  const { fireEvent, waitFor } = await import('@testing-library/react');
  const calls: { url: string; body?: string }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    calls.push({ url, body: options?.body as string | undefined });
    return { ok: true, json: async () => ({ data: options?.method === 'POST' ? { sessionId: 'visit', state: 'unpaid', version: 3, quoteId: 'frozen', lines: [], totalMinor: 100000, supportedTenders: ['paystack'] } : { sessionId: 'visit', state: 'open', version: 2, lineVersion: 5, lines: [] } }) };
  }));
  render(<VenueCheckout token="token" sessionId="visit" />);
  const freeze = await screen.findByRole('button', { name: /review and freeze/i });
  expect((freeze as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(freeze);
  await waitFor(() => expect(calls.some(call => call.body?.includes('ageVerified'))).toBe(true));
  expect(JSON.parse(calls.find(call => call.body?.includes('ageVerified'))!.body!)).toEqual({ expectedVersion: 2, lineVersion: 5, ageVerified: true });
});

test('platform_bill_does_not_offer_cash_or_split', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: { sessionId: 'visit', state: 'unpaid', version: 1, quoteId: 'q', totalMinor: 100000, lines: [], supportedTenders: ['paystack'] } }) })));
  render(<VenueCheckout token="token" sessionId="visit" />);
  expect(await screen.findByRole('button', { name: /pay with paystack/i })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /cash|split/i })).toBeNull();
});

test('cash_moves_to_settled_only_from_server_confirmation', async () => {
  const { fireEvent } = await import('@testing-library/react');
  vi.stubGlobal('fetch', vi.fn(async (_url: string, options?: RequestInit) => ({ ok: true, json: async () => ({ data: options?.method === 'POST' ? { state: 'settled', changeMinor: 0, bill: { sessionId: 'visit', state: 'settled', version: 3, lines: [], totalMinor: 100000, outstandingMinor: 0 } } : { sessionId: 'visit', state: 'unpaid', version: 1, quoteId: 'q', totalMinor: 100000, lines: [], supportedTenders: ['cash', 'paystack'] } }) })));
  render(<VenueCheckout token="token" sessionId="visit" />);
  fireEvent.change(await screen.findByLabelText(/cash received/i), { target: { value: '1000' } });
  fireEvent.click(screen.getByRole('button', { name: /record cash/i }));
  expect(await screen.findByText(/payment settled/i)).toBeTruthy();
  expect(screen.queryByRole('button', { name: /record cash/i })).toBeNull();
});
test('pending_checkout_can_resume_its_existing_provider_session', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: { sessionId: 'visit', state: 'payment_pending', lines: [], authorizationUrl: 'https://checkout.paystack.com/existing' } }) })));
  render(<VenueCheckout token="token" sessionId="visit" />);
  const resume = await screen.findByRole('link', { name: /resume secure checkout/i });
  expect(resume.getAttribute('href')).toBe('https://checkout.paystack.com/existing');
  expect(screen.queryByRole('button', { name: /pay with/i })).toBeNull();
});

// S5: the service_charge financial line renders exactly like the
// minimum_shortfall line — labelled by the approved policy's displayLabel
// (the server sets the line description to it), amount incl. tax, and it
// changes no totals rendering.
test('service_charge_financial_line_renders_like_the_minimum_line', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: {
    sessionId: 'visit', state: 'unpaid', version: 2, quoteId: 'q', currency: 'NGN',
    lines: [], financialLines: [
      { kind: 'minimum_shortfall', description: 'Minimum spend shortfall', amountMinor: 20000, taxMinor: 0 },
      { kind: 'service_charge', description: 'Service charge 12.5%', amountMinor: 3125, taxMinor: 0 },
    ],
    totalMinor: 123125, outstandingMinor: 123125, supportedTenders: ['paystack'],
  } }) })));
  render(<VenueCheckout token="token" sessionId="visit" />);
  expect(await screen.findByText('Service charge 12.5%')).toBeTruthy();
  expect(screen.getByText('Minimum spend shortfall')).toBeTruthy();
  // ₦31.25 = 3125 minor; rendered once, next to the shortfall line.
  expect(screen.getAllByText('₦31.25')).toHaveLength(1);
  expect(screen.getByText('₦1,231.25')).toBeTruthy();
});

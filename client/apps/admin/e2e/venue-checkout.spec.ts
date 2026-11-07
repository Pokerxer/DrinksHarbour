import { test, expect } from '@playwright/test';
const base = { sessionId: 'visit', version: 2, lineVersion: 1, lines: [{ lineId: 'line', revision: 1, name: 'Bottle', quantity: 1, unitPriceMinor: 100000, netMinor: 100000, taxMinor: 0 }], totalMinor: 100000, commissionMinor: 0, taxMinor: 0, supportedTenders: ['cash', 'paystack'], quoteId: 'quote' };
test('freeze cash and close without a second sale', async ({ page }) => {
  let state = 'open', collections = 0;
  await page.route('**/api/**', async route => {
    const request = route.request(); let data: object;
    if (request.url().endsWith('/collections')) {
      expect(request.headers()['idempotency-key']).toBeTruthy(); expect(request.postDataJSON().amountTenderedMinor).toBe(100000);
      collections++; state = 'settled'; data = { state, bill: { ...base, state, outstandingMinor: 0 } };
    } else if (request.method() === 'POST') { expect(request.postDataJSON()).toEqual({ expectedVersion: 2, lineVersion: 1, ageVerified: true }); state = 'unpaid'; data = { ...base, state }; }
    else data = { ...base, state };
    await route.fulfill({ json: { data } });
  });
  await page.goto('/e2e/venue-fixture.html'); await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Review and freeze bill' }).click();
  await page.getByLabel('Cash received (₦)').fill('1000'); await page.getByRole('button', { name: 'Record cash payment' }).click();
  await expect(page.getByText('Payment settled. Visit closed.')).toBeVisible(); await expect(page.getByRole('button', { name: 'Record cash payment' })).toHaveCount(0); expect(collections).toBe(1);
});
test('pending and received funds survive refresh without pay-again', async ({ page }) => {
  let state = 'payment_pending';
  await page.route('**/api/**', async route => { if (route.request().url().endsWith('/reconcile')) state = 'settled'; await route.fulfill({ json: { data: { ...base, state } } }); });
  await page.goto('/e2e/venue-fixture.html'); await expect(page.getByText(/payment is pending/i)).toBeVisible();
  state = 'receipt_verified'; await page.reload(); await expect(page.getByText(/funds received/i)).toBeVisible(); await expect(page.getByRole('button', { name: /pay with/i })).toHaveCount(0);
  await page.getByRole('button', { name: 'Check payment' }).click(); await expect(page.getByText('Payment settled. Visit closed.')).toBeVisible();
});
test('stale freeze refuses money collection', async ({ page }) => {
  await page.route('**/api/**', async route => { if (route.request().method() === 'POST') await route.fulfill({ status: 409, json: { message: 'Visit changed; refresh the bill' } }); else await route.fulfill({ json: { data: { ...base, state: 'open' } } }); });
  await page.goto('/e2e/venue-fixture.html'); await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Review and freeze bill' }).click();
  await expect(page.getByRole('alert')).toHaveText('Visit changed; refresh the bill'); await expect(page.getByRole('button', { name: /record cash|pay with/i })).toHaveCount(0);
});
test('booking seating carries explicit location table and version', async ({ page }) => {
  await page.route('**/api/**', async route => {
    const url = route.request().url(); let data: object = { ...base, state: 'receipt_verified' };
    if (url.endsWith('/readiness')) data = { identityVersion: 1, locations: [{ id: 'location', name: 'Main bar', actions: { 'session.create': true }, tables: [{ id: 'table', name: 'Table 1', version: 7 }] }] };
    if (url.endsWith('/status')) expect(route.request().postDataJSON()).toEqual({ to: 'checked_in', locationId: 'location', tableIds: ['table'], expectedTableVersions: [7] });
    await route.fulfill({ json: { data } });
  });
  await page.goto('/e2e/venue-fixture.html?booking'); await page.getByLabel('Venue location').selectOption('location'); await page.getByLabel('Available table').selectOption('table'); await page.getByRole('button', { name: 'Check in' }).click(); await expect(page.getByText(/funds received/i)).toBeVisible();
});
for (const conflict of ['stock', 'version']) test(`booking menu remains editable after ${conflict} conflict and reload`, async ({ page }) => {
  let state = 'open', version = 2, quantity = 2, failed = false;
  await page.route('**/api/**', async route => {
    const request = route.request(); const url = request.url();
    if (url.endsWith('/menu')) return route.fulfill({ json: { data: [{ _id: 'size', subProductId: 'sub', name: 'Bottle', price: 1000 }] } });
    if (!failed && ((conflict === 'stock' && request.method() === 'POST') || (conflict === 'version' && request.method() === 'PUT'))) {
      failed = true; version++;
      return route.fulfill({ status: 409, json: { message: `${conflict} conflict; refresh` } });
    }
    if (request.method() === 'PUT') { expect(request.postDataJSON().expectedVersion).toBe(version); quantity = request.postDataJSON().lines[0].quantity; version++; }
    if (request.method() === 'POST') { state = 'unpaid'; version++; }
    await route.fulfill({ json: { data: { ...base, state, version, lineVersion: version, lines: [{ ...base.lines[0], subProductId: 'sub', sizeId: 'size', quantity }] } } });
  });
  await page.goto('/e2e/venue-fixture.html?menu');
  const input = page.getByLabel('Quantity for Bottle'); await expect(input).toHaveValue('2');
  if (conflict === 'version') await input.fill('3');
  await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Review and freeze bill' }).click();
  await expect(page.getByRole('alert')).toHaveText(`${conflict} conflict; refresh`); await expect(input).toBeVisible();
  await input.fill('1'); await page.getByRole('button', { name: 'Reload checkout status' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0); await expect(input).toHaveValue('1');
  await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Review and freeze bill' }).click();
  await expect(page.getByRole('button', { name: 'Pay with Paystack' })).toBeVisible(); await expect(input).toHaveCount(0); expect(quantity).toBe(1);
});
test('booking pays accepted service removed from the live menu without a line write', async ({ page }) => {
  let state = 'open'; let saves = 0;
  await page.route('**/api/**', async route => {
    const request = route.request(), url = request.url();
    if (url.endsWith('/menu')) return route.fulfill({ json: { data: [] } });
    if (request.method() === 'PUT') { saves++; return route.fulfill({ status: 404, json: { message: 'Hidden item cannot be sold again' } }); }
    if (request.method() === 'POST') state = url.endsWith('/collections') ? 'settled' : 'unpaid';
    const bill = { ...base, state, lines: [{ ...base.lines[0], subProductId: 'sub', sizeId: 'size' }] };
    await route.fulfill({ json: { data: url.endsWith('/collections') ? { state, bill } : bill } });
  });
  await page.goto('/e2e/venue-fixture.html?menu'); await expect(page.getByText(/1 × Bottle/)).toBeVisible();
  await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Review and freeze bill' }).click();
  await page.getByLabel('Cash received (₦)').fill('1000'); await page.getByRole('button', { name: 'Record cash payment' }).click();
  await expect(page.getByText('Payment settled. Visit closed.')).toBeVisible(); expect(saves).toBe(0);
});

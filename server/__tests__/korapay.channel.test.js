// server/__tests__/korapay.channel.test.js
//
// Every Korapay web order was stored as `bank_transfer` regardless of how the
// customer actually paid, because:
//   (a) verifyKorapayCharge read `data.payment_method || data.channel`, and
//       Korapay's GET /charges/:reference response contains NEITHER field — it
//       reports the channel structurally, as a nested object named after the
//       channel used (verified against a live charge: a bank-transfer payment
//       came back with a `bank_transfer` object and no `payment_method` key),
//   (b) so the channel was always undefined, and the checkout return page
//       hardcoded 'bank_transfer' to fill the gap.
// The checkout button that opens Korapay is labelled "Card / Bank Transfer /
// USSD" and initialises with channels ['card','bank_transfer'], so the shopper's
// pre-payment selection can never identify the real method — only this response
// can. These tests pin the derivation.

const test = require('node:test');
const assert = require('node:assert');
const axios = require('axios');
const paymentService = require('../services/payment.service');

// Shape copied from a real Korapay charge lookup (reference DH-1785091671377-…).
const bankTransferCharge = {
  reference: 'DH-1785091671377-0403f39b',
  status: 'success',
  amount: '7200.00',
  amount_paid: '7200.00',
  currency: 'NGN',
  transaction_date: '2026-07-26T18:48:51.000Z',
  bank_transfer: {
    payer_bank_account: {
      account_number: '7035609301',
      account_name: 'JORDAN HERO OGENE',
      bank_name: 'Opay',
      bank_code: '100004',
    },
  },
  payer_bank_account: { bank_name: 'Opay' },
};

function stubCharge(data) {
  const original = axios.get;
  axios.get = async () => ({ data: { status: true, data } });
  return () => { axios.get = original; };
}

test('derives bank_transfer from the nested channel object (no payment_method field)', async () => {
  const restore = stubCharge(bankTransferCharge);
  try {
    const result = await paymentService.verifyKorapayCharge(bankTransferCharge.reference);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.channel, 'bank_transfer', 'channel must not be undefined');
    assert.strictEqual(result.data.paymentMethod, 'bank_transfer');
  } finally {
    restore();
  }
});

test('a card charge is reported as card, not bank_transfer', async () => {
  const restore = stubCharge({
    reference: 'DH-card-1',
    status: 'success',
    amount: '15000.00',
    amount_paid: '15000.00',
    currency: 'NGN',
    card: { card_type: 'visa', first_six: '424242', last_four: '4242' },
  });
  try {
    const result = await paymentService.verifyKorapayCharge('DH-card-1');
    assert.strictEqual(result.data.channel, 'card');
    assert.strictEqual(result.data.paymentMethod, 'card', 'card payments were being filed as bank transfers');
  } finally {
    restore();
  }
});

test('an explicit payment_method (webhook-style payload) still wins', async () => {
  const restore = stubCharge({
    reference: 'DH-mm-1',
    status: 'success',
    amount: 2500,
    amount_paid: 2500,
    currency: 'NGN',
    payment_method: 'mobile_money',
  });
  try {
    const result = await paymentService.verifyKorapayCharge('DH-mm-1');
    assert.strictEqual(result.data.channel, 'mobile_money');
    assert.strictEqual(result.data.paymentMethod, 'mobile_money');
  } finally {
    restore();
  }
});

test('a channel with no canonical method of its own keeps the raw channel', async () => {
  // USSD is a bank push — it stores as bank_transfer, but the exact channel
  // must survive on paymentDetails.channel for reconciliation.
  const restore = stubCharge({
    reference: 'DH-ussd-1',
    status: 'success',
    amount: 5000,
    amount_paid: 5000,
    currency: 'NGN',
    ussd: { bank_code: '058' },
  });
  try {
    const result = await paymentService.verifyKorapayCharge('DH-ussd-1');
    assert.strictEqual(result.data.channel, 'ussd', 'raw gateway channel must be preserved');
    assert.strictEqual(result.data.paymentMethod, 'bank_transfer');
  } finally {
    restore();
  }
});

test('an unreadable channel yields no method rather than a fabricated one', async () => {
  const restore = stubCharge({
    reference: 'DH-unknown-1',
    status: 'success',
    amount: 1000,
    amount_paid: 1000,
    currency: 'NGN',
  });
  try {
    const result = await paymentService.verifyKorapayCharge('DH-unknown-1');
    assert.strictEqual(result.data.channel, null);
    assert.strictEqual(result.data.paymentMethod, null, 'guessing here is what caused the original bug');
  } finally {
    restore();
  }
});

test('resolveGatewayPaymentMethod re-derives the method server-side', async () => {
  // The browser is not a trustworthy source for "how was this paid" — it only
  // knows which button was pressed before the gateway hand-off.
  const restore = stubCharge({ ...bankTransferCharge, bank_transfer: undefined, card: { last_four: '4242' } });
  try {
    const method = await paymentService.resolveGatewayPaymentMethod('bank_transfer', {
      method: 'korapay',
      reference: 'DH-1785091671377-0403f39b',
    });
    assert.strictEqual(method, 'card', 'the gateway response must override the client claim');
  } finally {
    restore();
  }
});

test('resolveGatewayPaymentMethod keeps the client method for non-gateway payments', async () => {
  const original = axios.get;
  axios.get = async () => { throw new Error('gateway must not be called for wallet payments'); };
  try {
    const method = await paymentService.resolveGatewayPaymentMethod('wallet', { method: 'wallet' });
    assert.strictEqual(method, 'wallet');
    const cod = await paymentService.resolveGatewayPaymentMethod('cash_on_delivery', null);
    assert.strictEqual(cod, 'cash_on_delivery');
  } finally {
    axios.get = original;
  }
});

test('resolveGatewayPaymentMethod never fails the order when the gateway is unreachable', async () => {
  // Money has already left the customer at this point; a lookup failure must
  // degrade to the client-supplied method, never throw.
  const original = axios.get;
  axios.get = async () => { throw new Error('ETIMEDOUT'); };
  try {
    const method = await paymentService.resolveGatewayPaymentMethod('bank_transfer', {
      method: 'korapay',
      reference: 'DH-timeout-1',
    });
    assert.strictEqual(method, 'bank_transfer');
  } finally {
    axios.get = original;
  }
});

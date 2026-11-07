'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
test('merchant email reports its net merchandise without foreign lines or payout claims', async t => {
  process.env.MAIL_PASSWORD = 'phase-a-fixture-only'; process.env.SENDER_EMAIL_ADDRESS = 'sender@example.test';
  let mail;
  t.mock.method(require('nodemailer'), 'createTransport', () => ({ verify: async () => {}, sendMail: async value => { mail = value; return { messageId: 'offline-only' }; } }));
  const email = require('../services/email.service');
  await email.sendNewOrderNotificationToTenant({ _id: 'order', orderNumber: 'PHASE', subtotal: 300, totalAmount: 330, shippingFee: 30,
    items: [{ tenant: 'a', product: { _id: 'p1', name: 'OWN-BOTTLE' }, quantity: 1, itemSubtotal: 100, discountAmount: 10 },
      { tenant: 'b', product: { _id: 'p2', name: 'FOREIGN-BOTTLE' }, quantity: 1, itemSubtotal: 200 }], shippingAddress: {} },
    { _id: 'a', email: 'merchant@example.test' }, { firstName: 'Buyer', lastName: 'One' });
  assert.ok(mail); assert.equal(mail.html.includes('FOREIGN-BOTTLE'), false);
  assert.equal(mail.html.includes('Your Payout'), false);
  assert.match(mail.subject, /90/);
  delete process.env.MAIL_PASSWORD; delete process.env.SENDER_EMAIL_ADDRESS;
});

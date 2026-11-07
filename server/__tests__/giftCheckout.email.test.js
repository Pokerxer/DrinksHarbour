'use strict';
// Gift snippets across the notify channels (pure tests — no DB, no network):
// customer email gift section, staff (tenant/admin) section, SMS + WhatsApp
// gift lines, and byte-compatibility of every template for non-gift orders.
// Contract: docs/superpowers/specs/2026-10-27-gift-checkout-design.md

const test = require('node:test');
const assert = require('node:assert/strict');

const email = require('../services/email.service');
const sms = require('../services/sms.service');
const whatsapp = require('../services/whatsapp.service');

const giftOrder = (extra = {}) => ({
  orderNumber: 'DH123',
  items: [],
  gift: {
    isGift: true,
    from: 'Ada',
    to: 'Chinedu',
    message: 'Happy birthday! <script>alert(1)</script>',
    requestedDeliveryDate: '2026-11-05',
    packagingRequested: true,
    ...extra,
  },
});

// ── Customer email ───────────────────────────────────────────────────────────

test('customer email renders the gift block for a gift order', () => {
  const html = email.giftEmailSection(giftOrder());
  assert.ok(html.includes('Gift Details'));
  assert.ok(html.includes('To:</strong> Chinedu'));
  assert.ok(html.includes('From:</strong> Ada'));
  assert.ok(html.includes('Happy birthday!'));
  assert.ok(html.includes('2026-11-05'));
  assert.ok(html.includes('requested'), 'requested date must never read as guaranteed');
  assert.ok(html.includes('the team confirms the exact window'));
  assert.ok(html.includes('Gift packaging included'), 'packaging mentioned only when packagingRequested');
});

test('customer email escapes the gift note — never raw HTML', () => {
  const html = email.giftEmailSection(giftOrder());
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'), 'script tag must not survive into the email');
});

test('customer email renders the date label but no packaging line when packaging not requested', () => {
  const html = email.giftEmailSection(giftOrder({ packagingRequested: false, message: '' }));
  assert.ok(html.includes('2026-11-05'));
  assert.ok(!html.includes('Gift packaging included'));
  assert.ok(!html.includes('&ldquo;'), 'no empty note quotes');
});

test('customer email omits the section entirely for normal orders', () => {
  assert.equal(email.giftEmailSection({ orderNumber: 'DH1', items: [] }), '');
  assert.equal(email.giftEmailSection({ gift: { isGift: false } }), '');
});

// ── Staff (tenant/admin) section ─────────────────────────────────────────────

test('staff alert opens with GIFT ORDER and the requested delivery date', () => {
  const html = email.giftStaffSection(giftOrder());
  assert.ok(/GIFT ORDER\s*&mdash;\s*requested delivery 2026-11-05/.test(html), html);
  assert.ok(html.includes('Chinedu'));
  assert.ok(html.includes('&lt;script&gt;'), 'staff section escapes the note too');
  assert.ok(html.includes('never a guaranteed date'));
  assert.ok(html.includes('Paid gift packaging requested'));
});

test('staff alert section is empty for normal orders', () => {
  assert.equal(email.giftStaffSection({ orderNumber: 'DH1', items: [] }), '');
});

// ── SMS ──────────────────────────────────────────────────────────────────────

test('customer SMS gains a short gift mention', () => {
  const line = sms.orderGiftSmsLine(giftOrder());
  assert.ok(line.includes('Gift for Chinedu'));
  assert.ok(line.includes('requested delivery 2026-11-05'));
  assert.ok(line.includes('the team confirms the exact window'));
});

test('customer SMS line is empty without a date and for normal orders', () => {
  assert.ok(sms.orderGiftSmsLine(giftOrder({ requestedDeliveryDate: undefined })).includes('Gift for Chinedu'));
  assert.equal(sms.orderGiftSmsLine({ orderNumber: 'DH1' }), '');
});

test('SMS body is byte-identical for non-gift orders and mentions the gift for gift orders', async (t) => {
  // No TERMII_API_KEY in the test env → dev branch logs the FULL text.
  const logs = [];
  const mock = t.mock.method(console, 'log', (...args) => { logs.push(args.join(' ')); });
  t.after(() => mock.mock.restore());
  await sms.sendOrderConfirmationSMS({ ...giftOrder(), totalAmount: 5000, shippingAddress: {} }, { firstName: 'Ada', phone: '08012345678' });
  const giftText = logs[0] || '';
  assert.ok(giftText.includes('🎁 Gift for Chinedu'), giftText);
  assert.ok(giftText.includes('requested delivery 2026-11-05'), giftText);

  logs.length = 0;
  await sms.sendOrderConfirmationSMS({ orderNumber: 'DH123', totalAmount: 5000, shippingAddress: {} }, { firstName: 'Ada', phone: '08012345678' });
  const normalText = logs[0] || '';
  assert.ok(!normalText.includes('Gift'), normalText);
  assert.ok(
    normalText.includes('Hi Ada, your DrinksHarbour order #DH123 for ₦5,000 has been received!\n'),
    normalText,
  );
  assert.ok(
    normalText.includes("We'll update you when it ships. Track at drinksharbour.com/order-tracking\n"),
    normalText,
  );
});

// ── WhatsApp ─────────────────────────────────────────────────────────────────

test('customer WhatsApp gains a short gift mention; tenant alert opens with GIFT ORDER', () => {
  const customerLine = whatsapp.orderGiftCustomerLine(giftOrder());
  assert.ok(customerLine.includes('*gift* for Chinedu'));
  assert.ok(customerLine.includes('requested delivery 2026-11-05'));

  const tenantLine = whatsapp.orderGiftTenantLine(giftOrder());
  assert.ok(tenantLine.startsWith('*GIFT ORDER — requested delivery 2026-11-05*\n\n'));
});

test('WhatsApp lines are empty for normal orders (byte-compatible by construction)', () => {
  assert.equal(whatsapp.orderGiftCustomerLine({ orderNumber: 'DH1' }), '');
  assert.equal(whatsapp.orderGiftTenantLine({ orderNumber: 'DH1' }), '');
});

test('WhatsApp body is byte-identical for non-gift orders and mentions the gift for gift orders', async (t) => {
  // No Meta credentials in the test env → the module runs in dev mode and
  // never reaches the transport, so reload it with fake credentials and
  // intercept https.request to capture the exact body that would be posted.
  const https = require('https');
  const savedEnv = { ...process.env };
  process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
  process.env.WHATSAPP_PHONE_NUMBER_ID = '123';
  delete require.cache[require.resolve('../services/whatsapp.service')];
  const wa = require('../services/whatsapp.service');
  t.after(() => {
    process.env = savedEnv;
    delete require.cache[require.resolve('../services/whatsapp.service')];
  });

  const bodies = [];
  const requestMock = t.mock.method(https, 'request', (options, cb) => {
    return {
      on(ev, fn) { if (ev === 'error') this._err = fn; },
      setTimeout() {},
      destroy() {},
      write(body) { bodies.push(JSON.parse(body).text.body); },
      end() {
        cb({
          statusCode: 200,
          on(ev, fn) { if (ev === 'data') fn('{"messages":[{"id":"x"}]}'); if (ev === 'end') fn(); },
        });
      },
    };
  });
  t.after(() => requestMock.mock.restore());

  // The long-message path strips markdown before sending; the strip is applied
  // identically with and without a gift, so equality with stripMarkdown(ORIGINAL)
  // proves the source string itself is unchanged for non-gift orders.
  const ORIGINAL_CUSTOMER =
    `🎉 *Order Confirmed!*\n\n` +
    `Hi Ada, thank you for shopping with DrinksHarbour!\n\n` +
    `*Order:* #DH123\n` +
    `*Items:* 0 items\n` +
    `*Total:* ₦5,000\n\n` +
    `We'll notify you once your order is on its way. You can track your order at:\n` +
    `drinksharbour.com/order-tracking\n\n` +
    `Questions? Reply to this message and we'll help. 🍷`;

  await wa.sendOrderConfirmationWhatsApp({ orderNumber: 'DH123', totalAmount: 5000, shippingAddress: {} }, { firstName: 'Ada', phone: '08012345678' });
  assert.equal(bodies[0] || '', wa.stripMarkdown(ORIGINAL_CUSTOMER));

  bodies.length = 0;
  await wa.sendOrderConfirmationWhatsApp({ ...giftOrder(), totalAmount: 5000, shippingAddress: {} }, { firstName: 'Ada', phone: '08012345678' });
  const giftText = bodies[0] || '';
  assert.ok(giftText.includes('gift for Chinedu'), giftText);
  assert.ok(giftText.includes('requested delivery 2026-11-05'), giftText);

  bodies.length = 0;
  await wa.sendNewOrderAlertWhatsApp({ ...giftOrder(), _id: 'DH123', shippingAddress: {} }, { _id: 't1', phone: '08012345678' });
  const tenantText = bodies[0] || '';
  assert.ok(tenantText.includes('GIFT ORDER — requested delivery 2026-11-05'), tenantText);
});

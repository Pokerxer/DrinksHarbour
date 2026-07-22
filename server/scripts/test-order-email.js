// scripts/test-order-email.js
// Live test of the order mailing system (customer + vendor + admin).
//   1. Verifies the SMTP connection to the configured mail server.
//   2. Sends all three order emails using the actual templates/code paths,
//      with a realistic 2-vendor order + coupon + shipping so the revenue
//      calculations are exercised and can be eyeballed.
// Usage: node -r dotenv/config scripts/test-order-email.js [recipient@example.com]
require('dotenv').config();

const nodemailer = require('nodemailer');

const RECIPIENT = process.argv[2] || process.env.ADMIN_EMAIL || process.env.SENDER_EMAIL_ADDRESS;

const MAIL_HOST = process.env.MAIL_HOST || 'premium356.web-hosting.com';
const MAIL_PORT = parseInt(process.env.MAIL_PORT, 10) || 465;
const MAIL_SECURE = process.env.MAIL_SECURE != null ? process.env.MAIL_SECURE === 'true' : MAIL_PORT === 465;

// Two vendors, a coupon and a shipping fee — clean round numbers so the math
// is trivial to verify by eye:
//   merchandise 63,000 − coupon 5,000 + shipping 2,500 = order total 60,500
//   vendor payout 54,000 · platform markup 9,000 · platform net 6,500
const tenantA = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Harbour Wines', email: RECIPIENT, phone: '+2348000000001' };
const tenantB = { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', name: 'Maitama Spirits', email: RECIPIENT, phone: '+2348000000002' };

const mockOrder = {
  _id: '000000000000000000000000',
  orderNumber: `TEST-${Date.now().toString().slice(-6)}`,
  status: 'pending',
  paymentStatus: 'paid',
  paymentMethod: 'card',
  placedAt: new Date(),
  subtotal: 63000,
  discountTotal: 5000,           // basket coupon
  shippingFee: 2500,
  totalAmount: 60500,            // 63000 − 5000 + 2500
  platformCommissionTotal: 9000,
  shippingInfo: { zoneLabel: 'Abuja Metro', daysMin: 1, daysMax: 2, isFree: false, source: 'google', distanceKm: 8, stops: 2, routeType: 'multi-vendor' },
  shippingAddress: {
    fullName: 'Test Customer', addressLine1: '39 Gana St, Maitama',
    city: 'Abuja', state: 'FCT', country: 'Nigeria', phone: '+2348000000000',
  },
  items: [
    {
      product: { name: 'Chateau Margaux 2015', images: [] },
      size: { name: '75cl' }, tenant: tenantA,
      quantity: 2, priceAtPurchase: 22500, itemSubtotal: 45000,
      tenantRevenueShare: 39000, platformCommission: 6000,
      discountAmount: 0, tenantRevenueModel: 'markup',
    },
    {
      product: { name: 'Don Julio 1942 Añejo', images: [] },
      size: { name: '70cl' }, tenant: tenantB,
      quantity: 1, priceAtPurchase: 18000, itemSubtotal: 18000,
      tenantRevenueShare: 15000, platformCommission: 3000,
      discountAmount: 0, tenantRevenueModel: 'markup',
    },
  ],
};

const mockCustomer = { firstName: 'Test', lastName: 'Customer', email: RECIPIENT, phone: '+2348000000000' };

(async () => {
  console.log('\n📧 Mailing system test (customer + vendor + admin)');
  console.log(`   Server:    ${MAIL_HOST}:${MAIL_PORT} (secure=${MAIL_SECURE})`);
  console.log(`   From:      ${process.env.SENDER_EMAIL_ADDRESS}`);
  console.log(`   Recipient: ${RECIPIENT}`);
  console.log('   Expected:  order total ₦60,500 · vendor payout ₦54,000 · platform net ₦6,500\n');

  if (!process.env.MAIL_PASSWORD || process.env.MAIL_PASSWORD.includes('your-')) {
    console.error('❌ MAIL_PASSWORD is unset or still a placeholder — aborting.');
    process.exit(1);
  }

  // ── 1. Verify SMTP connection + auth ──
  const transporter = nodemailer.createTransport({
    host: MAIL_HOST, port: MAIL_PORT, secure: MAIL_SECURE,
    auth: { user: process.env.SENDER_EMAIL_ADDRESS, pass: process.env.MAIL_PASSWORD },
  });
  try {
    await transporter.verify();
    console.log('✅ SMTP connection & auth OK');
  } catch (err) {
    console.error('❌ SMTP verify failed:', err.message);
    process.exit(1);
  }

  const email = require('../services/email.service');
  await new Promise((r) => setTimeout(r, 2500)); // let the service transporter init

  const send = async (label, fn) => {
    try {
      const r = await fn();
      if (r?.success && r.messageId !== 'dev-mode') console.log(`✅ ${label} sent — ${r.messageId}`);
      else if (r?.messageId === 'dev-mode') console.log(`⚠️  ${label}: dev mode (transporter not ready)`);
      else console.error(`❌ ${label} failed:`, r?.error || 'unknown');
    } catch (e) { console.error(`❌ ${label} threw:`, e.message); }
  };

  await send('Customer confirmation', () => email.sendOrderConfirmationToCustomer(mockOrder, mockCustomer));
  await send('Vendor notification (A)', () => email.sendNewOrderNotificationToTenant(mockOrder, tenantA, mockCustomer));
  await send('Admin notification',      () => email.sendNewOrderNotificationToAdmin(mockOrder, mockCustomer));

  console.log(`\n🎉 Check the ${RECIPIENT} inbox (and spam) for order #${mockOrder.orderNumber} — 3 emails.`);
  process.exit(0);
})();

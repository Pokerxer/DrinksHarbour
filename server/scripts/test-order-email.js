// scripts/test-order-email.js
// Live test of the order-confirmation mailing system.
//   1. Verifies the SMTP connection to the configured mail server.
//   2. Sends a real order-confirmation email using the actual template/code path.
// Usage: node -r dotenv/config scripts/test-order-email.js [recipient@example.com]
require('dotenv').config();

const nodemailer = require('nodemailer');

const RECIPIENT = process.argv[2] || process.env.ADMIN_EMAIL || process.env.SENDER_EMAIL_ADDRESS;

const MAIL_HOST = process.env.MAIL_HOST || 'premium356.web-hosting.com';
const MAIL_PORT = parseInt(process.env.MAIL_PORT, 10) || 465;
const MAIL_SECURE = process.env.MAIL_SECURE != null ? process.env.MAIL_SECURE === 'true' : MAIL_PORT === 465;

// A minimal but realistic populated order + customer for the template.
const mockOrder = {
  _id: '000000000000000000000000',
  orderNumber: `TEST-${Date.now().toString().slice(-6)}`,
  status: 'pending',
  paymentStatus: 'paid',
  paymentMethod: 'card',
  placedAt: new Date(),
  subtotal: 45000,
  discountTotal: 0,
  shippingFee: 2500,
  totalAmount: 47500,
  shippingInfo: { zoneLabel: 'Abuja Metro', daysMin: 1, daysMax: 2, isFree: false, source: 'google', distanceKm: 8 },
  shippingAddress: {
    fullName: 'Test Customer', addressLine1: '39 Gana St, Maitama',
    city: 'Abuja', state: 'FCT', country: 'Nigeria', phone: '+2348000000000',
  },
  items: [
    {
      product: { name: 'Jameson Irish Whiskey', images: [] },
      size: { name: '70cl' },
      tenant: { name: 'DrinksHarbour Store' },
      quantity: 2,
      priceAtPurchase: 22500,
      itemSubtotal: 45000,
      tenantRevenueShare: 39000,
      platformCommission: 6000,
      discountAmount: 0,
    },
  ],
};

const mockCustomer = {
  firstName: 'Test', lastName: 'Customer',
  email: RECIPIENT, phone: '+2348000000000',
};

(async () => {
  console.log('\n📧 Mailing system test');
  console.log(`   Server:    ${MAIL_HOST}:${MAIL_PORT} (secure=${MAIL_SECURE})`);
  console.log(`   From:      ${process.env.SENDER_EMAIL_ADDRESS}`);
  console.log(`   Recipient: ${RECIPIENT}\n`);

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
    console.log('✅ Step 1/2: SMTP connection & auth OK');
  } catch (err) {
    console.error('❌ Step 1/2: SMTP verify failed:', err.message);
    process.exit(1);
  }

  // ── 2. Send a real order-confirmation email via the actual service ──
  // Require after verify so we know creds are good; the service inits its own
  // transporter asynchronously on require, so give it a moment to become ready.
  const emailService = require('../services/email.service');
  await new Promise((r) => setTimeout(r, 2500));

  try {
    const result = await emailService.sendOrderConfirmationToCustomer(mockOrder, mockCustomer);
    if (result?.success && result.messageId !== 'dev-mode') {
      console.log(`✅ Step 2/2: Order confirmation sent — messageId: ${result.messageId}`);
      console.log(`\n🎉 Check the ${RECIPIENT} inbox (and spam) for order #${mockOrder.orderNumber}.`);
      process.exit(0);
    }
    if (result?.messageId === 'dev-mode') {
      console.error('❌ Step 2/2: Service ran in DEV MODE (its transporter was not ready). SMTP itself works — retry, or check init.');
      process.exit(1);
    }
    console.error('❌ Step 2/2: Send failed:', result?.error || 'unknown error');
    process.exit(1);
  } catch (err) {
    console.error('❌ Step 2/2: Send threw:', err.message);
    process.exit(1);
  }
})();

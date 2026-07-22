// scripts/test-order-email.js
// Live test + reconciliation of the order mailing system (customer + vendor + admin).
//
//   1. Builds every order line by running the REAL pricing pipeline
//      (utils/pricing.js) exactly the way order.controller.js#createOrder does,
//      so the persisted money fields (itemSubtotal, tenantRevenueShare,
//      platformCommission) are genuinely reconciled — not hardcoded.
//   2. Exercises three shapes so the revenue math is fully covered:
//        • markup vendor, normal single line
//        • markup vendor, quantity-triggered PACK-RATE line
//        • COMMISSION vendor (undercut path)
//   3. Asserts the money identities before sending:
//        • per item:  itemSubtotal == tenantRevenueShare + platformCommission
//        • order:     splitCheck == 0  (merch == vendors + platform)
//        • order:     totalCheck == 0  (merch − coupon + shipping == orderTotal)
//   4. Verifies the SMTP connection, then sends all three emails through the
//      actual templates/code paths.
//
// Usage: node -r dotenv/config scripts/test-order-email.js [recipient@example.com]
require('dotenv').config();

const nodemailer = require('nodemailer');
const {
  calcPlatformCostPrice,
  calculateSizePricing,
  resolveRevenueRates,
  resolveLineRates,
  resolveEffectiveUnitPrice,
  DEFAULT_PLATFORM_MARKUP,
} = require('../utils/pricing');
const emailSvc = require('../services/email.service');
const { calculateVendorTotals, calculateOrderBreakdown } = emailSvc;

const RECIPIENT = process.argv[2] || process.env.ADMIN_EMAIL || process.env.SENDER_EMAIL_ADDRESS;

const MAIL_HOST = process.env.MAIL_HOST || 'premium356.web-hosting.com';
const MAIL_PORT = parseInt(process.env.MAIL_PORT, 10) || 465;
const MAIL_SECURE = process.env.MAIL_SECURE != null ? process.env.MAIL_SECURE === 'true' : MAIL_PORT === 465;

const round2 = (n) => Math.round(n * 100) / 100;

// ── Faithful mirror of order.controller.js#createOrder per-item pricing ────────
// Given the same raw docs the controller loads (tenant, product, subProduct,
// size) + line quantity, produce the persisted order-item money fields.
const buildOrderItem = ({ tenant, product, subProduct, size, quantity, display }) => {
  const revenueModel = tenant?.revenueModel ?? 'markup';
  const qty = quantity;

  const sizePricing = (size && tenant)
    ? calculateSizePricing(size, product, tenant, subProduct?.costPrice ?? 0, subProduct?.baseSellingPrice ?? 0)
    : null;

  const packApplied = sizePricing?.packUnitPrice != null &&
    sizePricing?.packThreshold != null && qty >= sizePricing.packThreshold;

  const { markupPct, commissionPct } = packApplied
    ? resolveLineRates(tenant, size, qty)
    : resolveRevenueRates(tenant, 1);

  let serverUnitPrice = sizePricing ? resolveEffectiveUnitPrice(sizePricing, qty) : 0;
  const customerPrice = serverUnitPrice > 0 ? serverUnitPrice : 0;
  const itemSubtotal = customerPrice * qty;

  const costPrice = size?.costPrice ?? subProduct?.costPrice ?? 0;
  const tenantSellingPrice = size?.sellingPrice ?? subProduct?.baseSellingPrice ?? 0;

  let vendorCostPerUnit = calcPlatformCostPrice(costPrice, tenantSellingPrice, revenueModel, markupPct, commissionPct);
  if (!vendorCostPerUnit || vendorCostPerUnit <= 0) {
    vendorCostPerUnit = customerPrice / (1 + DEFAULT_PLATFORM_MARKUP / 100);
  }

  const vendorPayout = vendorCostPerUnit * qty;
  const platformProfit = itemSubtotal - vendorPayout;

  return {
    ...display, // product/size/tenant objects for the email templates
    quantity: qty,
    priceAtPurchase: customerPrice,
    itemSubtotal: round2(itemSubtotal),
    discountAmount: 0,
    vendorPriceAtPurchase: round2(vendorCostPerUnit),
    tenantRevenueShare: round2(vendorPayout),
    platformCommission: round2(platformProfit),
    tenantRevenueModel: revenueModel,
    revenueRateAtPurchase: revenueModel === 'commission' ? commissionPct : markupPct,
    packRateApplied: packApplied,
  };
};

// ── Tenants ───────────────────────────────────────────────────────────────────
const tenantA = {
  _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Harbour Wines', email: RECIPIENT, phone: '+2348000000001',
  revenueModel: 'markup',
  markupPercentage: 25, commissionPercentage: 12,
  platformMarkupPercentage: 15,
  packMarkupPercentage: 15, packCommissionPercentage: 20, packRateMinUnits: 6,
};
const tenantB = {
  _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', name: 'Maitama Spirits', email: RECIPIENT, phone: '+2348000000002',
  revenueModel: 'commission',
  markupPercentage: 25, commissionPercentage: 12,
  platformMarkupPercentage: 15,
  packMarkupPercentage: 15, packCommissionPercentage: 20, packRateMinUnits: 6,
};

const productMarkup = { platformMarkup: 15, platformDiscount: null };

// ── Three lines exercising markup / pack-rate / commission ────────────────────
const items = [
  // 1) markup, normal single
  buildOrderItem({
    tenant: tenantA, product: productMarkup,
    subProduct: { costPrice: 10000, baseSellingPrice: 15000 },
    size: { _id: 's1', costPrice: 10000, sellingPrice: 15000, unitsPerPack: 1 },
    quantity: 2,
    display: { product: { name: 'Chateau Margaux 2015', images: [] }, size: { name: '75cl' }, tenant: tenantA },
  }),
  // 2) markup, PACK-RATE line (unitsPerPack 6, qty 6 → pack rates apply)
  buildOrderItem({
    tenant: tenantA, product: productMarkup,
    subProduct: { costPrice: 10000, baseSellingPrice: 15000 },
    size: { _id: 's2', costPrice: 10000, sellingPrice: 15000, unitsPerPack: 6 },
    quantity: 6,
    display: { product: { name: 'Veuve Clicquot Brut (6-pack rate)', images: [] }, size: { name: '75cl' }, tenant: tenantA },
  }),
  // 3) COMMISSION vendor
  buildOrderItem({
    tenant: tenantB, product: { platformMarkup: 15, platformDiscount: null },
    subProduct: { costPrice: 8000, baseSellingPrice: 12000 },
    size: { _id: 's3', costPrice: 8000, sellingPrice: 12000, unitsPerPack: 1 },
    quantity: 1,
    display: { product: { name: 'Don Julio 1942 Añejo', images: [] }, size: { name: '70cl' }, tenant: tenantB },
  }),
];

const merch = round2(items.reduce((s, i) => s + i.itemSubtotal, 0));
const couponDiscount = 5000; // platform-absorbed basket coupon
const shippingFee = 2500;
const totalAmount = round2(merch - couponDiscount + shippingFee);
const platformCommissionTotal = round2(items.reduce((s, i) => s + i.platformCommission, 0));

const mockOrder = {
  _id: '000000000000000000000000',
  orderNumber: `TEST-${Date.now().toString().slice(-6)}`,
  status: 'pending',
  paymentStatus: 'paid',
  paymentMethod: 'card',
  placedAt: new Date(),
  subtotal: merch,
  discountTotal: couponDiscount,
  shippingFee,
  totalAmount,
  platformCommissionTotal,
  shippingInfo: { zoneLabel: 'Abuja Metro', daysMin: 1, daysMax: 2, isFree: false, source: 'google', distanceKm: 8, stops: 2, routeType: 'multi-vendor' },
  shippingAddress: {
    fullName: 'Test Customer', addressLine1: '39 Gana St, Maitama',
    city: 'Abuja', state: 'FCT', country: 'Nigeria', phone: '+2348000000000',
  },
  items,
};

const mockCustomer = { firstName: 'Test', lastName: 'Customer', email: RECIPIENT, phone: '+2348000000000' };

// ── Assertions: the money identities must hold before we ever send ────────────
const assertReconciliation = () => {
  const failures = [];
  const ok = (cond, msg) => { console.log(`   ${cond ? '✅' : '❌'} ${msg}`); if (!cond) failures.push(msg); };

  console.log('\n🧮 Reconciliation (checkout pricing → email math)');

  // Per-item identity: itemSubtotal == vendorShare + platformCommission
  mockOrder.items.forEach((i, idx) => {
    const diff = round2(i.itemSubtotal - i.tenantRevenueShare - i.platformCommission);
    const tag = `${i.tenantRevenueModel}${i.packRateApplied ? '/pack' : ''}`;
    ok(diff === 0,
      `Line ${idx + 1} [${tag}] itemSubtotal ${i.itemSubtotal} == vendor ${i.tenantRevenueShare} + platform ${i.platformCommission} (Δ ${diff})`);
  });

  // Order-level breakdown identities (the actual email helper)
  const b = calculateOrderBreakdown(mockOrder);
  ok(b.splitCheck === 0, `splitCheck == 0 (got ${b.splitCheck}) — merch ${b.merchandiseSubtotal} == vendors ${b.totalVendorEarnings} + platform ${b.platformCommission}`);
  ok(b.totalCheck === 0, `totalCheck == 0 (got ${b.totalCheck}) — merch − coupon + shipping == orderTotal ${b.orderTotal}`);
  ok(round2(b.platformNet - (b.platformCommission + b.shippingFee - b.couponDiscount)) === 0,
    `platformNet ${b.platformNet} == markup ${b.platformCommission} + shipping ${b.shippingFee} − coupon ${b.couponDiscount}`);

  // Vendor totals identity (the vendor email helper): customer − platform == payout
  [tenantA, tenantB].forEach((t) => {
    const v = calculateVendorTotals(mockOrder, t._id);
    const diff = round2(v.customerSubtotal - v.platformCommission - v.vendorEarnings);
    ok(diff === 0,
      `${t.name} [${v.revenueModel}] customer ${v.customerSubtotal} − ${v.effectiveTakeRate}% ${v.platformCommission} == payout ${v.vendorEarnings} (Δ ${diff})`);
  });

  return failures;
};

(async () => {
  console.log('\n📧 Mailing system test + reconciliation (customer + vendor + admin)');
  console.log(`   Server:    ${MAIL_HOST}:${MAIL_PORT} (secure=${MAIL_SECURE})`);
  console.log(`   From:      ${process.env.SENDER_EMAIL_ADDRESS}`);
  console.log(`   Recipient: ${RECIPIENT}`);
  console.log(`   Order:     merch ₦${merch.toLocaleString()} − coupon ₦${couponDiscount.toLocaleString()} + shipping ₦${shippingFee.toLocaleString()} = total ₦${totalAmount.toLocaleString()}`);
  console.log(`              vendor payout ₦${round2(items.reduce((s, i) => s + i.tenantRevenueShare, 0)).toLocaleString()} · platform markup ₦${platformCommissionTotal.toLocaleString()} · platform net ₦${round2(platformCommissionTotal + shippingFee - couponDiscount).toLocaleString()}`);

  const failures = assertReconciliation();
  if (failures.length) {
    console.error(`\n❌ ${failures.length} reconciliation assertion(s) FAILED — not sending emails.`);
    process.exit(1);
  }
  console.log('\n✅ All reconciliation identities hold.');

  if (!process.env.MAIL_PASSWORD || process.env.MAIL_PASSWORD.includes('your-')) {
    console.error('\n❌ MAIL_PASSWORD is unset or still a placeholder — skipping live send.');
    process.exit(1);
  }

  // ── Verify SMTP connection + auth ──
  const transporter = nodemailer.createTransport({
    host: MAIL_HOST, port: MAIL_PORT, secure: MAIL_SECURE,
    auth: { user: process.env.SENDER_EMAIL_ADDRESS, pass: process.env.MAIL_PASSWORD },
  });
  try {
    await transporter.verify();
    console.log('\n✅ SMTP connection & auth OK');
  } catch (err) {
    console.error('\n❌ SMTP verify failed:', err.message);
    process.exit(1);
  }

  await new Promise((r) => setTimeout(r, 2500)); // let the service transporter init

  const send = async (label, fn) => {
    try {
      const r = await fn();
      if (r?.success && r.messageId !== 'dev-mode') console.log(`✅ ${label} sent — ${r.messageId}`);
      else if (r?.messageId === 'dev-mode') console.log(`⚠️  ${label}: dev mode (transporter not ready)`);
      else console.error(`❌ ${label} failed:`, r?.error || 'unknown');
    } catch (e) { console.error(`❌ ${label} threw:`, e.message); }
  };

  await send('Customer confirmation',    () => emailSvc.sendOrderConfirmationToCustomer(mockOrder, mockCustomer));
  await send('Vendor notification (A/markup)', () => emailSvc.sendNewOrderNotificationToTenant(mockOrder, tenantA, mockCustomer));
  await send('Vendor notification (B/commission)', () => emailSvc.sendNewOrderNotificationToTenant(mockOrder, tenantB, mockCustomer));
  await send('Admin notification',        () => emailSvc.sendNewOrderNotificationToAdmin(mockOrder, mockCustomer));

  console.log(`\n🎉 Check the ${RECIPIENT} inbox (and spam) for order #${mockOrder.orderNumber} — 4 emails.`);
  process.exit(0);
})();

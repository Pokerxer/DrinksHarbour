// services/email.service.js
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const path = require('path');
const fs   = require('fs');

// ─── Logo (base64-embedded so it renders in all email clients regardless of env) ─
const LOGO_PATH = path.join(__dirname, '../../client/apps/platform/public/images/logo.png');
const LOGO_SRC  = fs.existsSync(LOGO_PATH)
  ? 'data:image/png;base64,' + fs.readFileSync(LOGO_PATH).toString('base64')
  : `${process.env.FRONTEND_URL || 'https://drinksharbour.com'}/images/logo.png`;

// Email sending status
let emailServiceReady = false;
let transporter = null;

// Check if Google OAuth credentials are properly configured
const hasGoogleOAuth = process.env.MAILING_SERVICE_CLIENT_ID &&
                      process.env.MAILING_SERVICE_CLIENT_SECRET &&
                      process.env.MAILING_REFRESH_TOKEN &&
                      !process.env.MAILING_SERVICE_CLIENT_ID?.includes('your-');

// Check if simple SMTP credentials are configured
const hasSimpleSMTP = process.env.MAIL_PASSWORD &&
                     !process.env.MAIL_PASSWORD?.includes('your-');

// SMTP transport config — host/port/secure are env-driven so the same code
// works with the DrinksHarbour cPanel mail server (premium356.web-hosting.com,
// port 465 SSL) or any other provider without a code change. Defaults target
// the cPanel account documented for orders@drinksharbour.com.
const MAIL_HOST = process.env.MAIL_HOST || 'premium356.web-hosting.com';
const MAIL_PORT = parseInt(process.env.MAIL_PORT, 10) || 465;
// Port 465 uses implicit TLS (secure); 587/25 use STARTTLS (secure=false).
const MAIL_SECURE = process.env.MAIL_SECURE != null
  ? process.env.MAIL_SECURE === 'true'
  : MAIL_PORT === 465;

// Initialize email service
const initializeEmailService = async () => {
  if (hasSimpleSMTP) {
    try {
      transporter = nodemailer.createTransport({
        host: MAIL_HOST,
        port: MAIL_PORT,
        secure: MAIL_SECURE,
        auth: {
          user: process.env.SENDER_EMAIL_ADDRESS,
          pass: process.env.MAIL_PASSWORD,
        },
      });
      await transporter.verify();
      emailServiceReady = true;
      console.log(`✅ Email service initialized (SMTP ${MAIL_HOST}:${MAIL_PORT})`);
      return;
    } catch (error) {
      console.log('⚠️  SMTP connection failed:', error.message);
    }
  }

  if (hasGoogleOAuth) {
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.MAILING_SERVICE_CLIENT_ID,
        process.env.MAILING_SERVICE_CLIENT_SECRET,
        'https://developers.google.com/oauthplayground'
      );
      oauth2Client.setCredentials({ refresh_token: process.env.MAILING_REFRESH_TOKEN });
      await oauth2Client.getAccessToken();
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: process.env.SENDER_EMAIL_ADDRESS,
          clientId: process.env.MAILING_SERVICE_CLIENT_ID,
          clientSecret: process.env.MAILING_SERVICE_CLIENT_SECRET,
          refreshToken: process.env.MAILING_REFRESH_TOKEN,
          accessToken: oauth2Client.getAccessToken(),
        },
      });
      emailServiceReady = true;
      console.log('✅ Email service initialized (Google OAuth2)');
      return;
    } catch (error) {
      console.log('⚠️  Google OAuth2 failed:', error.message);
    }
  }

  console.log('⚠️  Mailing service not configured, using development mode');
  emailServiceReady = false;
};

initializeEmailService();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: 'NGN',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount || 0);

const formatDate = (dateString) =>
  new Date(dateString).toLocaleDateString('en-NG', {
    weekday: 'long', year: 'numeric', month: 'long',
    day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

const capitalize = (s) =>
  (s || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

/** Small coloured badge using inline-block span (works in most clients) */
const badge = (label, bg, color, border) =>
  `<span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background-color:${bg};color:${color};border:1px solid ${border};text-transform:capitalize;">${label}</span>`;

const paymentBadge = (status) => {
  const map = {
    paid:     ['#d1fae5','#065f46','#34d399'],
    pending:  ['#fef3c7','#92400e','#fcd34d'],
    failed:   ['#fee2e2','#991b1b','#fca5a5'],
    refunded: ['#e0e7ff','#3730a3','#a5b4fc'],
  };
  const [bg, color, border] = map[status?.toLowerCase()] || map.pending;
  return badge(status || 'Pending', bg, color, border);
};

const orderStatusBadge = (status) => {
  const map = {
    pending:    ['#fef3c7','#92400e','#fcd34d'],
    processing: ['#dbeafe','#1e40af','#60a5fa'],
    shipped:    ['#e0e7ff','#3730a3','#818cf8'],
    delivered:  ['#d1fae5','#065f46','#34d399'],
    cancelled:  ['#fee2e2','#991b1b','#fca5a5'],
  };
  const [bg, color, border] = map[status?.toLowerCase()] || map.pending;
  return badge(status || 'Pending', bg, color, border);
};

/** 2-column info table replacing the old flex infoGrid */
const infoTable = (cells) => {
  const rows = [];
  for (let i = 0; i < cells.length; i += 2) {
    const left  = cells[i];
    const right = cells[i + 1];
    rows.push(`
      <tr>
        <td width="50%" style="padding:8px 8px 8px 0;vertical-align:top;">
          <div style="padding:12px 16px;background-color:#f9fafb;border-radius:8px;">
            <p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px 0;">${left.label}</p>
            <p style="font-size:14px;font-weight:600;color:#111827;margin:0;">${left.value}</p>
          </div>
        </td>
        ${right ? `
        <td width="50%" style="padding:8px 0 8px 8px;vertical-align:top;">
          <div style="padding:12px 16px;background-color:#f9fafb;border-radius:8px;">
            <p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px 0;">${right.label}</p>
            <p style="font-size:14px;font-weight:600;color:#111827;margin:0;">${right.value}</p>
          </div>
        </td>` : '<td width="50%"></td>'}
      </tr>
    `);
  }
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows.join('')}</table>`;
};

/** Section heading — plain bold text, no SVG/flex */
const sectionHeading = (text, color = '#111827') =>
  `<h3 style="font-size:16px;font-weight:700;color:${color};margin:0 0 16px 0;padding-bottom:8px;border-bottom:2px solid #e5e7eb;">${text}</h3>`;

/** Placeholder image cell when product has no image */
const productImageCell = (imgUrl, altText) => {
  if (imgUrl && !imgUrl.includes('placeholder')) {
    return `<img src="${imgUrl}" alt="${altText}" width="72" height="72"
      style="width:72px;height:72px;object-fit:cover;border-radius:8px;display:block;" />`;
  }
  // Inline SVG placeholder — no external request
  return `<div style="width:72px;height:72px;border-radius:8px;background-color:#f3f4f6;display:inline-block;text-align:center;line-height:72px;font-size:24px;" aria-label="${altText}">&#127863;</div>`;
};

/** Delivery estimate text from shippingInfo */
const deliveryEstimate = (si) => {
  if (!si) return 'Within 7 business days';
  if (si.isFree) return 'Priority delivery';
  if (si.daysMin && si.daysMax) {
    if (si.daysMin === si.daysMax) return `${si.daysMin} business day${si.daysMin > 1 ? 's' : ''}`;
    return `${si.daysMin}–${si.daysMax} business days`;
  }
  return 'Within 7 business days';
};

/** Shipping line detail (distance, route stops) */
const shippingDetail = (si) => {
  if (!si || si.source !== 'google') return si?.zoneLabel || '';
  const parts = [];
  if (si.distanceKm) parts.push(`~${si.distanceKm} km by road`);
  if (si.stops >= 2)  parts.push(`${si.stops} vendor pickup stops`);
  return parts.join(' · ');
};

// ─── Revenue calculations ─────────────────────────────────────────────────────

const calculateVendorTotals = (order, tenantId) => {
  const vendorItems = order.items?.filter(item => {
    const id = item.tenant?._id?.toString() || item.tenant?.toString();
    return id === tenantId?.toString();
  }) || order.items || [];

  const customerSubtotal  = vendorItems.reduce((s, i) => s + (i.itemSubtotal || 0), 0);
  const vendorEarnings    = vendorItems.reduce((s, i) => s + (i.tenantRevenueShare || 0), 0);
  const platformCommission= vendorItems.reduce((s, i) => s + (i.platformCommission || 0), 0);
  const itemDiscounts     = vendorItems.reduce((s, i) => s + (i.discountAmount || 0), 0);
  const itemCount         = vendorItems.reduce((s, i) => s + i.quantity, 0);

  // Effective platform take rate — derived from the actual money split, so it
  // is correct for both markup and commission models and any per-line pack
  // overrides (order items don't persist platformMarkupPercentage).
  const effectiveTakeRate = customerSubtotal > 0
    ? Math.round((platformCommission / customerSubtotal) * 1000) / 10
    : 0;
  const revenueModel = vendorItems[0]?.tenantRevenueModel || 'markup';

  return { items: vendorItems, customerSubtotal, vendorEarnings, platformCommission, itemDiscounts, itemCount, effectiveTakeRate, revenueModel };
};

const calculateOrderBreakdown = (order) => {
  const totalCustomerPaid  = order.items?.reduce((s, i) => s + (i.itemSubtotal || 0), 0) || 0;
  const totalVendorEarnings= order.items?.reduce((s, i) => s + (i.tenantRevenueShare || 0), 0) || 0;
  const totalDiscounts     = order.items?.reduce((s, i) => s + (i.discountAmount || 0), 0) || 0;
  const platformCommission = order.platformCommissionTotal ||
    order.items?.reduce((s, i) => s + (i.platformCommission || 0), 0) || 0;

  const itemsByTenant = {};
  order.items?.forEach(item => {
    const tid = item.tenant?._id?.toString() || item.tenant?.toString() || 'no-tenant';
    if (!itemsByTenant[tid]) {
      itemsByTenant[tid] = { items: [], customerTotal: 0, vendorEarnings: 0, platformCommission: 0 };
    }
    itemsByTenant[tid].items.push(item);
    itemsByTenant[tid].customerTotal  += item.itemSubtotal || 0;
    itemsByTenant[tid].vendorEarnings += item.tenantRevenueShare || 0;
    itemsByTenant[tid].platformCommission += item.platformCommission || 0;
  });
  // Effective per-vendor take rate from the real split (see calculateVendorTotals).
  Object.values(itemsByTenant).forEach(d => {
    d.effectiveRate = d.customerTotal > 0
      ? Math.round((d.platformCommission / d.customerTotal) * 1000) / 10
      : 0;
  });

  // ── Order-level money reconciliation ─────────────────────────────────────
  // merchandiseSubtotal (pre-coupon) − couponDiscount + shippingFee = orderTotal.
  const merchandiseSubtotal = totalCustomerPaid;                 // sum of item subtotals
  const couponDiscount = order.discountTotal || 0;               // basket coupon (not item-level)
  const shippingFee = order.shippingFee || 0;
  const orderTotal = order.totalAmount != null
    ? order.totalAmount
    : merchandiseSubtotal - couponDiscount + shippingFee;

  // Platform's true margin on this order: markup profit, plus shipping it
  // retains, minus the coupon it absorbs. (Vendors are paid pre-coupon.)
  const platformNet = platformCommission + shippingFee - couponDiscount;

  // Item identity check: subtotal must equal vendor payout + platform markup.
  const splitCheck = Math.round((merchandiseSubtotal - totalVendorEarnings - platformCommission) * 100) / 100;
  // Total reconciliation: computed order total must match the stored total.
  const totalCheck = Math.round(((merchandiseSubtotal - couponDiscount + shippingFee) - orderTotal) * 100) / 100;

  return {
    totalCustomerPaid, totalVendorEarnings, totalDiscounts,
    platformCommission, itemsByTenant,
    merchandiseSubtotal, couponDiscount, shippingFee, orderTotal, platformNet,
    itemCount: order.items?.reduce((s, i) => s + i.quantity, 0) || 0,
    splitCheck, totalCheck,
    verification: splitCheck, // back-compat
  };
};

// ─── Email sender ─────────────────────────────────────────────────────────────

const sendEmail = async (options) => {
  try {
    if (!emailServiceReady) {
      console.log('\n📧 ========== EMAIL (Development Mode) ==========');
      console.log('To:', options.to);
      console.log('Subject:', options.subject);
      console.log('Preview: Check server logs for full email content\n');
      return { success: true, message: 'Email logged (dev mode)', messageId: 'dev-mode' };
    }

    const mailOptions = {
      from: `"${process.env.APP_NAME || 'DrinksHarbour'}" <${process.env.SENDER_EMAIL_ADDRESS}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email sending failed:', error.message);
    return { success: false, error: error.message };
  }
};

// ─── Shared email shell ───────────────────────────────────────────────────────
// Header structure:
//   1. White logo band  — always white, shows the brand logo
//   2. Coloured accent bar — thin bar in email-type colour (red / green / blue)
//   3. White body
//   4. Dark footer

const GOLD = '#c8a24a'; // DrinksHarbour warm gold — shared accent across emails

const emailShell = ({ accentColor, accentLabel, accentSubtitle, body, footerNote }) => {
  const accent = accentColor || '#8f1d1d'; // default brand burgundy
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${accentLabel} - DrinksHarbour</title>
</head>
<body style="margin:0;padding:0;background-color:#f1ede6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1ede6;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <!-- Preheader hint / spacing -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(60,20,20,0.14);border:1px solid #e7e0d5;">

          <!-- ① White logo band -->
          <tr>
            <td style="background-color:#ffffff;padding:26px 40px 22px;text-align:center;">
              <a href="${process.env.FRONTEND_URL || 'https://drinksharbour.com'}" style="display:inline-block;text-decoration:none;">
                <img src="${LOGO_SRC}"
                     alt="DrinksHarbour"
                     width="210"
                     style="display:block;margin:0 auto;width:210px;max-width:210px;height:auto;border:0;outline:none;" />
              </a>
            </td>
          </tr>

          <!-- Gold hairline -->
          <tr><td style="height:3px;background:linear-gradient(90deg, ${GOLD} 0%, #e6cf8f 50%, ${GOLD} 100%);font-size:0;line-height:0;">&nbsp;</td></tr>

          <!-- ② Coloured accent bar (gradient) -->
          <tr>
            <td style="background:linear-gradient(135deg, ${accent} 0%, ${accent}e6 60%, ${accent}c4 100%);padding:26px 40px;text-align:center;">
              <p style="font-size:22px;font-weight:800;color:#ffffff;margin:0;letter-spacing:-0.2px;">${accentLabel}</p>
              ${accentSubtitle ? `<p style="font-size:13px;color:rgba(255,255,255,0.9);margin:8px 0 0 0;letter-spacing:0.3px;">${accentSubtitle}</p>` : ''}
            </td>
          </tr>

          <!-- ③ Body -->
          <tr>
            <td style="background-color:#ffffff;padding:38px 40px;">
              ${body}
            </td>
          </tr>

          <!-- ④ Footer -->
          <tr>
            <td style="background-color:#171310;padding:30px 40px;text-align:center;">
              <img src="${LOGO_SRC}"
                   alt="DrinksHarbour"
                   width="132"
                   style="display:block;margin:0 auto 16px;width:132px;max-width:132px;height:auto;opacity:0.55;filter:grayscale(1) brightness(2);" />
              <p style="font-size:13px;color:#b7ada0;margin:0 0 10px 0;line-height:1.6;">${footerNote || 'Thank you for choosing DrinksHarbour — premium drinks, delivered.'}</p>
              <!-- Contact row -->
              <p style="font-size:12px;color:#8a8073;margin:0 0 16px 0;">
                <a href="${process.env.FRONTEND_URL || 'https://drinksharbour.com'}" style="color:${GOLD};text-decoration:none;font-weight:600;">drinksharbour.com</a>
                <span style="color:#4b463f;">&nbsp;&bull;&nbsp;</span>
                <a href="mailto:support@drinksharbour.com" style="color:#b7ada0;text-decoration:none;">support@drinksharbour.com</a>
              </p>
              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="border-top:1px solid #2b241e;padding-top:16px;">
                  <p style="font-size:11px;color:#6b6357;margin:0;">&#169; ${new Date().getFullYear()} DrinksHarbour Ltd. All rights reserved.</p>
                  <p style="font-size:11px;color:${GOLD};margin:6px 0 0 0;letter-spacing:1px;text-transform:uppercase;">One Harbour &bull; Endless Possibilities</p>
                </td></tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

// ─── 1. Customer order confirmation ──────────────────────────────────────────

const sendOrderConfirmationToCustomer = async (order, customer) => {
  const getProductImage = (item) => {
    if (item.product?.images?.length > 0) {
      const img = item.product.images.find(i => i?.url) || item.product.images[0];
      if (img?.url) return img.url;
    }
    if (item.subproduct?.images?.length > 0) {
      const img = item.subproduct.images.find(i => i?.url) || item.subproduct.images[0];
      if (img?.url) return img.url;
    }
    return null;
  };

  const si = order.shippingInfo;
  const addr = order.shippingAddress;

  const itemRows = (order.items || []).map(item => {
    const name    = item.product?.name || item.subproduct?.name || 'Product';
    const size    = item.size?.name || '';
    const vendor  = item.tenant?.name || '';
    const imgUrl  = getProductImage(item);
    const lineTotal = formatCurrency((item.priceAtPurchase || 0) * item.quantity);

    return `
      <tr>
        <td style="padding:14px 12px;border-bottom:1px solid #f3f4f6;vertical-align:top;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right:14px;vertical-align:top;">
                ${productImageCell(imgUrl, name)}
              </td>
              <td style="vertical-align:top;">
                <p style="font-size:14px;font-weight:700;color:#111827;margin:0 0 3px 0;">${name}</p>
                ${size   ? `<p style="font-size:12px;color:#6b7280;margin:0 0 2px 0;">${size}</p>` : ''}
                ${vendor ? `<p style="font-size:12px;color:#f97316;margin:0;">Sold by ${vendor}</p>` : ''}
              </td>
            </tr>
          </table>
        </td>
        <td style="padding:14px 12px;border-bottom:1px solid #f3f4f6;text-align:center;vertical-align:middle;">
          <span style="display:inline-block;background-color:#f3f4f6;padding:4px 12px;border-radius:6px;font-size:13px;font-weight:600;color:#374151;">${item.quantity}</span>
        </td>
        <td style="padding:14px 12px;border-bottom:1px solid #f3f4f6;text-align:right;vertical-align:middle;">
          <span style="font-size:14px;font-weight:700;color:#111827;">${lineTotal}</span>
        </td>
      </tr>
    `;
  }).join('');

  const couponRow = order.discountTotal > 0 ? `
    <tr>
      <td colspan="2" style="padding:10px 12px;text-align:right;font-size:13px;font-weight:600;color:#374151;">Discount</td>
      <td style="padding:10px 12px;text-align:right;font-size:13px;font-weight:600;color:#059669;">-${formatCurrency(order.discountTotal)}</td>
    </tr>` : '';

  const shippingDetailText = shippingDetail(si);
  const deliveryText = deliveryEstimate(si);

  const body = `
    <!-- Greeting -->
    <div style="text-align:center;margin-bottom:30px;">
      <p style="font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${GOLD};margin:0 0 10px 0;">Order Confirmed</p>
      <h2 style="font-size:26px;font-weight:800;color:#1a1310;margin:0 0 10px 0;letter-spacing:-0.4px;">Thank you, ${customer.firstName}! &#127867;</h2>
      <p style="font-size:15px;color:#6b7280;margin:0;line-height:1.65;">We've received your order and our team is preparing it with care.<br/>We'll send another note the moment it's on its way.</p>
    </div>

    <!-- Order number card -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:30px;">
      <tr>
        <td style="background:linear-gradient(135deg,#8f1d1d 0%,#b52a2a 100%);border-radius:14px;padding:22px 24px;text-align:center;border:1px solid #6f1414;">
          <p style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:${GOLD};margin:0 0 6px 0;font-weight:700;">Order Number</p>
          <p style="font-size:26px;font-weight:800;color:#ffffff;margin:0;letter-spacing:2px;">#${order.orderNumber}</p>
        </td>
      </tr>
    </table>

    <!-- Order summary info -->
    <div style="margin-bottom:28px;">
      ${sectionHeading('Order Summary')}
      ${infoTable([
        { label: 'Order Date',    value: formatDate(order.placedAt) },
        { label: 'Order Status',  value: orderStatusBadge(order.status) },
        { label: 'Payment',       value: paymentBadge(order.paymentStatus) },
        { label: 'Payment Method',value: capitalize(order.paymentMethod) },
      ])}
    </div>

    <!-- Items table -->
    <div style="margin-bottom:28px;">
      ${sectionHeading('Items Ordered')}
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <thead>
          <tr style="background-color:#f9fafb;">
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e5e7eb;">Product</th>
            <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e5e7eb;">Qty</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e5e7eb;">Total</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="padding:10px 12px;text-align:right;font-size:13px;color:#6b7280;">Subtotal</td>
            <td style="padding:10px 12px;text-align:right;font-size:13px;color:#6b7280;">${formatCurrency(order.subtotal)}</td>
          </tr>
          ${couponRow}
          <tr>
            <td colspan="2" style="padding:10px 12px;text-align:right;font-size:13px;color:#6b7280;">
              Shipping${shippingDetailText ? `<br/><span style="font-size:11px;">${shippingDetailText}</span>` : ''}
            </td>
            <td style="padding:10px 12px;text-align:right;font-size:13px;${order.shippingFee === 0 ? 'color:#059669;font-weight:700;' : 'color:#6b7280;'}">
              ${order.shippingFee === 0 ? 'FREE' : formatCurrency(order.shippingFee)}
            </td>
          </tr>
          <tr style="background-color:#faf6ef;">
            <td colspan="2" style="padding:16px 12px;text-align:right;font-size:16px;font-weight:700;color:#3a2a20;border-top:2px solid #ecdcbf;">Grand Total</td>
            <td style="padding:16px 12px;text-align:right;font-size:21px;font-weight:800;color:#8f1d1d;border-top:2px solid #ecdcbf;">${formatCurrency(order.totalAmount)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Delivery estimate -->
    <div style="margin-bottom:28px;">
      ${sectionHeading('Delivery Information')}
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf5ea;border-radius:12px;border:1px solid #ecdcbf;border-left:4px solid ${GOLD};">
        <tr>
          <td style="padding:18px 20px;">
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="padding-bottom:10px;">
                  <p style="font-size:12px;color:#9c7c2a;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px 0;font-weight:700;">&#128666; Estimated Delivery</p>
                  <p style="font-size:18px;font-weight:800;color:#4a3a10;margin:0;">${deliveryText}</p>
                </td>
              </tr>
              ${si?.zoneLabel || shippingDetailText ? `
              <tr>
                <td>
                  <p style="font-size:12px;color:#8a6d2a;margin:0;">
                    ${si?.zoneLabel || ''}${shippingDetailText ? (si?.zoneLabel ? ' &bull; ' : '') + shippingDetailText : ''}
                  </p>
                </td>
              </tr>` : ''}
            </table>
          </td>
        </tr>
      </table>
    </div>

    <!-- Shipping address -->
    <div style="margin-bottom:28px;">
      ${sectionHeading('Shipping Address')}
      <div style="background-color:#faf6ef;padding:16px 20px;border-radius:12px;border:1px solid #ece3d3;border-left:4px solid #8f1d1d;">
        <p style="font-size:15px;font-weight:700;color:#1a1310;margin:0 0 6px 0;">${addr?.fullName || `${customer.firstName} ${customer.lastName}`}</p>
        ${addr?.addressLine1 ? `<p style="font-size:14px;color:#4b5563;margin:0 0 3px 0;">${addr.addressLine1}</p>` : ''}
        ${(addr?.city || addr?.state) ? `<p style="font-size:14px;color:#4b5563;margin:0 0 3px 0;">${[addr?.city, addr?.state, addr?.postalCode].filter(Boolean).join(', ')}</p>` : ''}
        ${addr?.country ? `<p style="font-size:14px;color:#4b5563;margin:0 0 6px 0;">${addr.country}</p>` : ''}
        <p style="font-size:14px;color:#4b5563;margin:0;">&#128222; ${addr?.phone || customer.phone || ''}</p>
      </div>
    </div>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td align="center">
          <a href="${process.env.FRONTEND_URL || 'https://drinksharbour.com'}/order-confirmation?orderId=${order._id}"
             style="display:inline-block;background:linear-gradient(135deg,${GOLD} 0%,#b8862f 100%);color:#1a1310;padding:15px 36px;border-radius:12px;text-decoration:none;font-weight:800;font-size:14px;letter-spacing:0.3px;box-shadow:0 4px 16px rgba(200,162,74,0.38);">
            View Order Details &rarr;
          </a>
        </td>
      </tr>
    </table>

    <!-- Help -->
    <p style="font-size:13px;color:#9ca3af;text-align:center;margin:0;line-height:1.6;">
      Questions about your order? We're here to help &mdash;<br/>
      <a href="mailto:support@drinksharbour.com" style="color:#8f1d1d;font-weight:600;text-decoration:none;">support@drinksharbour.com</a>
    </p>
  `;

  const html = emailShell({
    accentColor:    '#8f1d1d',
    accentLabel:    `&#127867; Order Confirmed`,
    accentSubtitle: `Order #${order.orderNumber} &bull; ${formatCurrency(order.totalAmount)}`,
    body,
  });

  return sendEmail({
    to: customer.email,
    subject: `Order Confirmed! #${order.orderNumber} — DrinksHarbour`,
    html,
  });
};

// ─── 2. Vendor (tenant) new order notification ────────────────────────────────

const sendNewOrderNotificationToTenant = async (order, tenant, customer) => {
  const totals = calculateVendorTotals(order, tenant._id);
  const feeLabel = totals.revenueModel === 'commission' ? 'Commission' : 'Platform markup';
  const feeRate = totals.effectiveTakeRate; // derived from the actual money split

  const itemRows = totals.items.map(item => `
    <tr>
      <td style="padding:12px;border-bottom:1px solid #f3f4f6;">
        <p style="font-size:14px;font-weight:600;color:#111827;margin:0 0 2px 0;">${item.product?.name || 'Product'}</p>
        ${item.size?.name ? `<p style="font-size:12px;color:#6b7280;margin:0;">Size: ${item.size.name}</p>` : ''}
      </td>
      <td style="padding:12px;border-bottom:1px solid #f3f4f6;text-align:center;">
        <span style="display:inline-block;background-color:#f3f4f6;padding:4px 12px;border-radius:6px;font-size:13px;font-weight:600;color:#374151;">${item.quantity}</span>
      </td>
      <td style="padding:12px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:14px;font-weight:700;color:#111827;">${formatCurrency(item.itemSubtotal)}</td>
    </tr>
  `).join('');

  const addr = order.shippingAddress;

  const body = `
    <!-- Alert banner -->
    <div style="background:linear-gradient(135deg,#faf5ea,#f3e8cf);border:1px solid #ecdcbf;border-radius:12px;padding:22px;text-align:center;margin-bottom:26px;">
      <p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${GOLD};margin:0 0 8px 0;">New Order</p>
      <p style="font-size:21px;font-weight:800;color:#8f1d1d;margin:0 0 4px 0;">&#128722; You've made a sale!</p>
      <p style="font-size:14px;color:#8a6d2a;margin:0;">A customer just ordered from your store — time to fulfil.</p>
    </div>

    <!-- Order number card -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:26px;">
      <tr>
        <td style="background:linear-gradient(135deg,#8f1d1d 0%,#b52a2a 100%);border-radius:14px;padding:18px 24px;text-align:center;border:1px solid #6f1414;">
          <p style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:${GOLD};margin:0 0 5px 0;font-weight:700;">Order Number</p>
          <p style="font-size:22px;font-weight:800;color:#ffffff;margin:0;letter-spacing:1.5px;">#${order.orderNumber}</p>
        </td>
      </tr>
    </table>

    <!-- Order info -->
    <div style="margin-bottom:26px;">
      ${sectionHeading('Order Information')}
      ${infoTable([
        { label: 'Order Date',     value: formatDate(order.placedAt) },
        { label: 'Items to Fulfil', value: `${totals.itemCount} item(s)` },
        { label: 'Payment Method', value: capitalize(order.paymentMethod) },
        { label: 'Revenue Model',  value: `${feeRate}% ${feeLabel}` },
      ])}
    </div>

    <!-- Items sold -->
    <div style="margin-bottom:26px;">
      ${sectionHeading('Items Sold')}
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <thead>
          <tr style="background-color:#faf6ef;">
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#8a6d2a;text-transform:uppercase;border-bottom:2px solid #ecdcbf;">Product</th>
            <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:700;color:#8a6d2a;text-transform:uppercase;border-bottom:2px solid #ecdcbf;">Qty</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#8a6d2a;text-transform:uppercase;border-bottom:2px solid #ecdcbf;">Price Paid</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
    </div>

    <!-- Earnings breakdown -->
    <div style="margin-bottom:20px;">
      ${sectionHeading('Your Payout Breakdown')}
      <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#faf5ea,#f3e8cf);border-radius:12px;border:1px solid #ecdcbf;border-left:4px solid ${GOLD};">
        <tr>
          <td style="padding:20px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:5px 0;font-size:14px;color:#3a2a20;">Total Sales (Customer Paid)</td>
                <td style="padding:5px 0;font-size:14px;color:#3a2a20;text-align:right;">${formatCurrency(totals.customerSubtotal)}</td>
              </tr>
              <tr>
                <td style="padding:5px 0;font-size:13px;color:#8a6d2a;">${feeLabel} (${feeRate}%)</td>
                <td style="padding:5px 0;font-size:13px;color:#8a6d2a;text-align:right;">-${formatCurrency(totals.platformCommission)}</td>
              </tr>
              ${totals.itemDiscounts > 0 ? `
              <tr>
                <td style="padding:5px 0;font-size:13px;color:#8a6d2a;">Item Discounts</td>
                <td style="padding:5px 0;font-size:13px;color:#8a6d2a;text-align:right;">-${formatCurrency(totals.itemDiscounts)}</td>
              </tr>` : ''}
              <tr>
                <td colspan="2" style="padding-top:12px;"><hr style="border:none;border-top:2px solid #e6cf8f;margin:0;" /></td>
              </tr>
              <tr>
                <td style="padding:12px 0 0 0;font-size:17px;font-weight:800;color:#8f1d1d;">Your Payout</td>
                <td style="padding:12px 0 0 0;font-size:19px;font-weight:800;color:#8f1d1d;text-align:right;">${formatCurrency(totals.vendorEarnings)}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <p style="font-size:11px;color:#9ca3af;margin:8px 4px 0;line-height:1.5;">Your payout is calculated on the pre-discount item price. Platform-funded coupons and shipping do not reduce your earnings.</p>
    </div>

    <!-- Customer details -->
    <div style="margin-bottom:26px;">
      ${sectionHeading('Customer & Delivery Details')}
      ${infoTable([
        { label: 'Customer Name', value: `${customer.firstName} ${customer.lastName}` },
        { label: 'Email',         value: customer.email },
        { label: 'Phone',         value: customer.phone || '—' },
        { label: 'Payment',       value: paymentBadge(order.paymentStatus) },
      ])}
      ${addr ? `
      <div style="margin-top:12px;background-color:#faf6ef;padding:14px 18px;border-radius:12px;border:1px solid #ece3d3;border-left:4px solid #8f1d1d;">
        <p style="font-size:12px;font-weight:700;color:#8a6d2a;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 6px 0;">Shipping Address</p>
        <p style="font-size:14px;color:#1a1310;margin:0 0 2px 0;font-weight:600;">${addr.fullName || ''}</p>
        ${addr.addressLine1 ? `<p style="font-size:14px;color:#4b5563;margin:0 0 2px 0;">${addr.addressLine1}</p>` : ''}
        ${[addr.city, addr.state, addr.postalCode].filter(Boolean).join(', ') ? `<p style="font-size:14px;color:#4b5563;margin:0;">${[addr.city, addr.state, addr.postalCode].filter(Boolean).join(', ')}</p>` : ''}
      </div>` : ''}
    </div>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td align="center">
          <a href="${process.env.BACKEND_URL || process.env.FRONTEND_URL || 'https://drinksharbour.com'}/dashboard/orders"
             style="display:inline-block;background:linear-gradient(135deg,#8f1d1d,#b52a2a);color:#ffffff;padding:15px 36px;border-radius:12px;text-decoration:none;font-weight:800;font-size:14px;letter-spacing:0.3px;box-shadow:0 4px 16px rgba(143,29,29,0.28);">
            Process Order &rarr;
          </a>
        </td>
      </tr>
    </table>

    <!-- Urgency notice -->
    <div style="background:#faf5ea;border:1px solid #ecdcbf;border-left:4px solid ${GOLD};border-radius:10px;padding:14px 18px;text-align:center;">
      <p style="font-size:13px;font-weight:700;color:#8a6d2a;margin:0;">&#9889; Please process this order promptly to ensure timely delivery.</p>
    </div>
  `;

  const html = emailShell({
    accentColor:    '#8f1d1d',
    accentLabel:    '&#128722; New Order to Fulfil',
    accentSubtitle: `Order #${order.orderNumber} &bull; Payout ${formatCurrency(totals.vendorEarnings)}`,
    body,
    footerNote: 'Partner Notification — DrinksHarbour Vendor Dashboard',
  });

  return sendEmail({
    to: tenant.email || tenant.contactEmail,
    subject: `New Order #${order.orderNumber} — Your Payout: ${formatCurrency(totals.vendorEarnings)}`,
    html,
  });
};

// ─── 3. Admin order notification ─────────────────────────────────────────────

const sendNewOrderNotificationToAdmin = async (order, customer) => {
  const breakdown = calculateOrderBreakdown(order);

  const tenantBreakdowns = Object.entries(breakdown.itemsByTenant).map(([tenantId, data]) => {
    // Effective take rate from the real split (order items don't store a markup %).
    const takeRate = data.effectiveRate ?? 0;
    const tenantName = tenantId === 'no-tenant'
      ? 'Unassigned Items'
      : (data.items[0]?.tenant?.name || 'Unknown Vendor');

    return { tenantName, takeRate, data };
  });

  const vendorRows = tenantBreakdowns.map(({ tenantName, takeRate, data }) => `
    <tr>
      <td style="padding:14px 16px;border-bottom:1px solid #ece3d3;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <p style="font-size:14px;font-weight:700;color:#1a1310;margin:0 0 2px 0;">${tenantName}</p>
              <p style="font-size:11px;color:#9c7c2a;margin:0;">${takeRate}% platform take</p>
            </td>
            <td style="text-align:right;white-space:nowrap;">
              <p style="font-size:12px;color:#6b7280;margin:0 0 2px 0;">Cust. Paid: <strong style="color:#1a1310;">${formatCurrency(data.customerTotal)}</strong></p>
              <p style="font-size:12px;color:#6b7280;margin:0 0 2px 0;">Vendor Gets: <strong style="color:#3a2a20;">${formatCurrency(data.vendorEarnings)}</strong></p>
              <p style="font-size:12px;color:#6b7280;margin:0;">Platform: <strong style="color:#8f1d1d;">${formatCurrency(data.platformCommission)}</strong></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join('');

  const si = order.shippingInfo;

  const body = `
    <!-- Alert banner -->
    <div style="background:linear-gradient(135deg,#faf5ea,#f3e8cf);border:1px solid #ecdcbf;border-radius:12px;padding:22px;text-align:center;margin-bottom:26px;">
      <p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${GOLD};margin:0 0 8px 0;">Admin Alert</p>
      <p style="font-size:21px;font-weight:800;color:#8f1d1d;margin:0 0 4px 0;">&#128717; New Platform Order</p>
      <p style="font-size:14px;color:#8a6d2a;margin:0;">A new order has been placed on DrinksHarbour.</p>
    </div>

    <!-- Order number card -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:26px;">
      <tr>
        <td style="background:linear-gradient(135deg,#8f1d1d 0%,#b52a2a 100%);border-radius:14px;padding:18px 24px;text-align:center;border:1px solid #6f1414;">
          <p style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:${GOLD};margin:0 0 5px 0;font-weight:700;">Order Number</p>
          <p style="font-size:22px;font-weight:800;color:#ffffff;margin:0;letter-spacing:1.5px;">#${order.orderNumber}</p>
        </td>
      </tr>
    </table>

    <!-- Revenue summary -->
    <div style="margin-bottom:26px;">
      ${sectionHeading('Revenue Summary')}
      <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#faf5ea,#f3e8cf);border-radius:12px;border:1px solid #ecdcbf;border-left:4px solid ${GOLD};">
        <tr>
          <td style="padding:20px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:5px 0;font-size:13px;color:#8a6d2a;">Merchandise Subtotal</td>
                <td style="padding:5px 0;font-size:13px;color:#8a6d2a;text-align:right;">${formatCurrency(breakdown.merchandiseSubtotal)}</td>
              </tr>
              ${breakdown.couponDiscount > 0 ? `
              <tr>
                <td style="padding:5px 0;font-size:13px;color:#8a6d2a;">Coupon Discount</td>
                <td style="padding:5px 0;font-size:13px;color:#8a6d2a;text-align:right;">-${formatCurrency(breakdown.couponDiscount)}</td>
              </tr>` : ''}
              <tr>
                <td style="padding:5px 0;font-size:13px;color:#8a6d2a;">Shipping Fee</td>
                <td style="padding:5px 0;font-size:13px;color:#8a6d2a;text-align:right;">${breakdown.shippingFee === 0 ? 'FREE' : '+' + formatCurrency(breakdown.shippingFee)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0 5px;font-size:15px;font-weight:800;color:#1a1310;border-top:1px solid #e6cf8f;">Order Total (Customer Paid)</td>
                <td style="padding:8px 0 5px;font-size:15px;font-weight:800;color:#1a1310;text-align:right;border-top:1px solid #e6cf8f;">${formatCurrency(breakdown.orderTotal)}</td>
              </tr>
              <tr>
                <td style="padding:5px 0;font-size:13px;color:#8a6d2a;">Paid to Vendors</td>
                <td style="padding:5px 0;font-size:13px;color:#8a6d2a;text-align:right;">-${formatCurrency(breakdown.totalVendorEarnings)}</td>
              </tr>
              <tr>
                <td style="padding:5px 0;font-size:13px;color:#8a6d2a;">Platform Markup Profit</td>
                <td style="padding:5px 0;font-size:13px;color:#8a6d2a;text-align:right;">${formatCurrency(breakdown.platformCommission)}</td>
              </tr>
              <tr>
                <td colspan="2" style="padding:10px 0 0;"><hr style="border:none;border-top:2px solid #e6cf8f;margin:0;" /></td>
              </tr>
              <tr>
                <td style="padding:10px 0 0 0;font-size:17px;font-weight:800;color:#8f1d1d;">Platform Net Margin</td>
                <td style="padding:10px 0 0 0;font-size:19px;font-weight:800;color:#8f1d1d;text-align:right;">${formatCurrency(breakdown.platformNet)}</td>
              </tr>
              <tr>
                <td colspan="2" style="padding:4px 0 0;font-size:10px;color:#b09a6a;">Markup profit + shipping retained − coupon absorbed</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      ${breakdown.splitCheck !== 0 || breakdown.totalCheck !== 0 ? `
      <div style="margin-top:10px;padding:10px 14px;background-color:#fbeaea;border-radius:8px;border-left:4px solid #8f1d1d;">
        <p style="font-size:12px;font-weight:700;color:#8f1d1d;margin:0;">&#9888; Reconciliation flag — split: ${breakdown.splitCheck.toFixed(2)}, total: ${breakdown.totalCheck.toFixed(2)} (both should be 0)</p>
      </div>` : `
      <div style="margin-top:10px;padding:10px 14px;background-color:#faf5ea;border-radius:8px;border-left:4px solid ${GOLD};">
        <p style="font-size:12px;font-weight:700;color:#8a6d2a;margin:0;">&#10003; Item split &amp; order total reconciled</p>
      </div>`}
    </div>

    <!-- Vendor breakdown -->
    <div style="margin-bottom:24px;">
      ${sectionHeading('Vendor Breakdown')}
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        ${vendorRows}
      </table>
    </div>

    <!-- Shipping info -->
    ${si ? `
    <div style="margin-bottom:24px;">
      ${sectionHeading('Shipping Details')}
      ${infoTable([
        { label: 'Delivery Estimate', value: deliveryEstimate(si) },
        { label: 'Route Type',        value: capitalize(si.routeType || 'standard') },
        ...(si.distanceKm ? [{ label: 'Distance', value: `~${si.distanceKm} km` }] : []),
        ...(si.stops >= 1 ? [{ label: 'Vendor Stops', value: `${si.stops}` }] : []),
      ])}
    </div>` : ''}

    <!-- Order stats -->
    <div style="margin-bottom:24px;">
      ${sectionHeading('Order Statistics')}
      ${infoTable([
        { label: 'Total Items',    value: `${breakdown.itemCount}` },
        { label: 'Payment Status', value: paymentBadge(order.paymentStatus) },
        { label: 'Payment Method', value: capitalize(order.paymentMethod) },
        { label: 'Customer Type',  value: order.user ? 'Registered User' : 'Guest Checkout' },
      ])}
    </div>

    <!-- Customer info -->
    <div style="margin-bottom:24px;">
      ${sectionHeading('Customer Information')}
      ${infoTable([
        { label: 'Name',  value: `${customer.firstName} ${customer.lastName}` },
        { label: 'Email', value: customer.email },
        { label: 'Phone', value: customer.phone || '—' },
        { label: 'Order Date', value: formatDate(order.placedAt) },
      ])}
    </div>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <a href="${process.env.BACKEND_URL || process.env.FRONTEND_URL || 'https://drinksharbour.com'}/admin/orders/${order._id}"
             style="display:inline-block;background:linear-gradient(135deg,#8f1d1d,#b52a2a);color:#ffffff;padding:15px 36px;border-radius:12px;text-decoration:none;font-weight:800;font-size:14px;letter-spacing:0.3px;box-shadow:0 4px 16px rgba(143,29,29,0.28);">
            View Full Order Details &rarr;
          </a>
        </td>
      </tr>
    </table>
  `;

  const html = emailShell({
    accentColor:    '#8f1d1d',
    accentLabel:    '&#128276; New Platform Order',
    accentSubtitle: `Order #${order.orderNumber} &bull; ${formatCurrency(breakdown.orderTotal)} &bull; Admin`,
    body,
    footerNote: 'Admin Notification — DrinksHarbour Platform',
  });

  const adminEmail = process.env.ADMIN_EMAIL || process.env.SENDER_EMAIL_ADDRESS;
  if (!adminEmail) {
    console.log('⚠️  Admin email not configured, skipping admin notification');
    return { success: false, message: 'Admin email not configured' };
  }

  return sendEmail({
    to: adminEmail,
    subject: `[Admin] New Order #${order.orderNumber} — Revenue: ${formatCurrency(breakdown.totalCustomerPaid)} | Commission: ${formatCurrency(breakdown.platformCommission)}`,
    html,
  });
};

// ─── 4. Email verification code ───────────────────────────────────────────────

const sendVerificationCodeEmail = async ({ email, code, firstName }) => {
  if (!emailServiceReady) {
    console.log('⚠️  Email service not ready, cannot send verification code');
    return { success: false, message: 'Email service not configured' };
  }

  const html = emailShell({
    accentColor:    '#7c3aed',
    accentLabel:    '&#128274; Verify Your Email',
    accentSubtitle: 'Complete your account setup',
    body: `
      <p style="font-size:16px;color:#374151;margin:0 0 16px 0;">Hello <strong>${firstName || 'there'}</strong>,</p>
      <p style="font-size:14px;color:#6b7280;line-height:1.7;margin:0 0 24px 0;">
        Thank you for registering on DrinksHarbour. Use the verification code below to complete your account setup.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td style="background:linear-gradient(135deg,#f5f7fa,#c3cfe2);border-radius:12px;padding:28px;text-align:center;">
            <p style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px 0;">Your Verification Code</p>
            <p style="font-size:44px;font-weight:800;color:#7c3aed;letter-spacing:10px;font-family:Courier New,monospace;margin:0;">${code}</p>
          </td>
        </tr>
      </table>
      <p style="font-size:13px;color:#9ca3af;text-align:center;margin:0 0 20px 0;">
        &#9200; This code expires in <strong style="color:#dc2626;">10 minutes</strong>
      </p>
      <div style="background-color:#fffbeb;border-left:4px solid #f59e0b;padding:14px 18px;border-radius:6px;">
        <p style="font-size:13px;color:#92400e;margin:0;">
          <strong>&#128274; Security notice:</strong> Never share this code. Our team will never ask for it.
        </p>
      </div>
    `,
    footerNote: 'Need help? Email support@drinksharbour.com',
  });

  return sendEmail({
    to: email,
    subject: '&#128274; Verify Your Email - DrinksHarbour',
    html,
  });
};

// ─── 5. Purchase order to vendor ─────────────────────────────────────────────

const sendPurchaseOrderToVendor = async (purchaseOrder, vendor, tenant) => {
  const docType   = purchaseOrder.type === 'rfq' ? 'Request for Quotation (RFQ)' : 'Purchase Order (PO)';
  const docNumber = purchaseOrder.poNumber || purchaseOrder.rfqNumber || 'N/A';

  const itemRows = (purchaseOrder.items || []).map((item, i) => `
    <tr style="${i % 2 === 0 ? '' : 'background-color:#f9fafb;'}">
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;">${i + 1}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;font-weight:600;">
        ${item.subProductName || '—'}${item.sizeName ? ` <span style="font-size:12px;color:#6b7280;">(${item.sizeName})</span>` : ''}
      </td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:14px;color:#374151;">${item.quantity || 0}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:14px;color:#374151;">${formatCurrency(item.unitCost || 0)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:14px;font-weight:700;color:#111827;">${formatCurrency(item.totalCost || 0)}</td>
    </tr>
  `).join('');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${docType} - DrinksHarbour</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:720px;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#1e3a8a,#3b82f6);padding:32px 40px;">
              <p style="font-size:20px;font-weight:800;color:#ffffff;margin:0 0 4px 0;">${docType}</p>
              <p style="font-size:13px;color:rgba(255,255,255,0.8);margin:0;">From: ${tenant?.name || 'DrinksHarbour'}</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;padding:32px 40px;">

              <!-- Meta info -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td width="33%" style="padding:12px;background-color:#f9fafb;border:1px solid #e5e7eb;vertical-align:top;">
                    <p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px 0;">${docType.split(' ')[0]} No.</p>
                    <p style="font-size:15px;font-weight:700;color:#1e3a8a;margin:0;">${docNumber}</p>
                  </td>
                  <td width="33%" style="padding:12px;background-color:#f9fafb;border:1px solid #e5e7eb;border-left:none;vertical-align:top;">
                    <p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px 0;">Date</p>
                    <p style="font-size:13px;font-weight:600;color:#111827;margin:0;">${formatDate(purchaseOrder.orderDate || new Date())}</p>
                  </td>
                  <td width="33%" style="padding:12px;background-color:#f9fafb;border:1px solid #e5e7eb;border-left:none;vertical-align:top;">
                    <p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px 0;">Expected Delivery</p>
                    <p style="font-size:13px;font-weight:600;color:#111827;margin:0;">${formatDate(purchaseOrder.expectedArrival)}</p>
                  </td>
                </tr>
              </table>

              <!-- Vendor info -->
              <p style="font-size:15px;font-weight:700;color:#374151;margin:0 0 12px 0;">Vendor Details</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td width="50%" style="padding:12px;background-color:#f9fafb;border:1px solid #e5e7eb;vertical-align:top;">
                    <p style="font-size:13px;color:#374151;margin:0 0 4px 0;"><strong>Vendor:</strong> ${vendor?.name || purchaseOrder.vendorName || 'N/A'}</p>
                    <p style="font-size:13px;color:#374151;margin:0;"><strong>Contact:</strong> ${vendor?.contactPerson?.name || '—'}</p>
                  </td>
                  <td width="50%" style="padding:12px;background-color:#f9fafb;border:1px solid #e5e7eb;border-left:none;vertical-align:top;">
                    <p style="font-size:13px;color:#374151;margin:0 0 4px 0;"><strong>Email:</strong> ${vendor?.email || '—'}</p>
                    <p style="font-size:13px;color:#374151;margin:0;"><strong>Phone:</strong> ${vendor?.phone || '—'}</p>
                  </td>
                </tr>
              </table>

              <!-- Items table -->
              <p style="font-size:15px;font-weight:700;color:#374151;margin:0 0 12px 0;">Order Items</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <thead>
                  <tr style="background-color:#f3f4f6;">
                    <th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e5e7eb;">#</th>
                    <th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e5e7eb;">Product</th>
                    <th style="padding:11px 14px;text-align:center;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e5e7eb;">Qty</th>
                    <th style="padding:11px 14px;text-align:right;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e5e7eb;">Unit Price</th>
                    <th style="padding:11px 14px;text-align:right;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e5e7eb;">Total</th>
                  </tr>
                </thead>
                <tbody>${itemRows}</tbody>
                <tfoot>
                  <tr style="background-color:#f9fafb;">
                    <td colspan="4" style="padding:13px 14px;text-align:right;font-size:14px;font-weight:700;color:#374151;">Grand Total</td>
                    <td style="padding:13px 14px;text-align:right;font-size:16px;font-weight:800;color:#1e3a8a;">${formatCurrency(purchaseOrder.totalAmount || purchaseOrder.grandTotal || 0)}</td>
                  </tr>
                </tfoot>
              </table>

              ${purchaseOrder.notes ? `
              <p style="font-size:15px;font-weight:700;color:#374151;margin:0 0 10px 0;">Notes</p>
              <p style="font-size:14px;color:#374151;background-color:#f9fafb;padding:14px 18px;border-radius:8px;border:1px solid #e5e7eb;margin:0 0 20px 0;">${purchaseOrder.notes}</p>` : ''}

              ${purchaseOrder.termsConditions ? `
              <p style="font-size:15px;font-weight:700;color:#374151;margin:0 0 10px 0;">Terms &amp; Conditions</p>
              <p style="font-size:13px;color:#6b7280;background-color:#f9fafb;padding:14px 18px;border-radius:8px;border:1px solid #e5e7eb;margin:0;">${purchaseOrder.termsConditions}</p>` : ''}
            </td>
          </tr>
          <tr>
            <td style="background-color:#111827;padding:24px 40px;text-align:center;">
              <p style="font-size:13px;color:#9ca3af;margin:0 0 4px 0;">This is an automated email from DrinksHarbour. Please do not reply directly.</p>
              <p style="font-size:11px;color:#6b7280;margin:0;">&#169; ${new Date().getFullYear()} DrinksHarbour. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const subject = purchaseOrder.type === 'rfq'
    ? `Request for Quotation ${docNumber} - ${tenant?.name || 'DrinksHarbour'}`
    : `Purchase Order ${docNumber} - ${tenant?.name || 'DrinksHarbour'}`;

  return sendEmail({
    to: vendor?.email || purchaseOrder.vendorEmail,
    subject,
    html,
  });
};

// ─── 6. Password reset email ─────────────────────────────────────────────────

const sendPasswordResetEmail = async ({ email, firstName, resetToken }) => {
  const frontendUrl = process.env.FRONTEND_URL || 'https://drinksharbour.com';
  const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

  const html = emailShell({
    accentColor:    '#dc2626',
    accentLabel:    '&#128272; Reset Your Password',
    accentSubtitle: 'Secure your DrinksHarbour account',
    body: `
      <p style="font-size:16px;color:#374151;margin:0 0 16px 0;">Hello <strong>${firstName || 'there'}</strong>,</p>
      <p style="font-size:14px;color:#6b7280;line-height:1.7;margin:0 0 24px 0;">
        We received a request to reset your DrinksHarbour account password. Click the button below to choose a new password.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td style="text-align:center;">
            <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#dc2626,#991b1b);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:8px;box-shadow:0 4px 14px rgba(220,38,38,0.30);">
              Reset Password
            </a>
          </td>
        </tr>
      </table>
      <p style="font-size:13px;color:#9ca3af;text-align:center;margin:0 0 20px 0;">
        &#9200; This link expires in <strong style="color:#dc2626;">1 hour</strong>
      </p>
      <p style="font-size:13px;color:#6b7280;line-height:1.7;margin:0 0 16px 0;">
        If the button doesn't work, copy and paste this link into your browser:<br/>
        <a href="${resetUrl}" style="color:#dc2626;word-break:break-all;">${resetUrl}</a>
      </p>
      <div style="background-color:#fffbeb;border-left:4px solid #f59e0b;padding:14px 18px;border-radius:6px;">
        <p style="font-size:13px;color:#92400e;margin:0;">
          <strong>&#128272; Security notice:</strong> If you didn't request a password reset, you can safely ignore this email. Your account is still secure.
        </p>
      </div>
    `,
    footerNote: 'Need help? Email support@drinksharbour.com',
  });

  return sendEmail({
    to: email,
    subject: '&#128272; Reset Your Password - DrinksHarbour',
    html,
  });
};

// ─── 7. Email verification (6-digit code) ─────────────────────────────────────

const sendEmailVerificationEmail = async ({ email, firstName, code }) => {
  const html = emailShell({
    accentColor:    '#b20202',
    accentLabel:    '&#9989; Verify Your Email',
    accentSubtitle: 'Complete your DrinksHarbour registration',
    body: `
      <p style="font-size:16px;color:#374151;margin:0 0 16px 0;">Hello <strong>${firstName || 'there'}</strong>,</p>
      <p style="font-size:14px;color:#6b7280;line-height:1.7;margin:0 0 24px 0;">
        Welcome to DrinksHarbour! Use the 6-digit code below to verify your email address and activate your account.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td style="background:linear-gradient(135deg,#f5f7fa,#c3cfe2);border-radius:12px;padding:28px;text-align:center;">
            <p style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px 0;">Your Verification Code</p>
            <p style="font-size:44px;font-weight:800;color:#b20202;letter-spacing:10px;font-family:Courier New,monospace;margin:0;">${code}</p>
          </td>
        </tr>
      </table>
      <p style="font-size:13px;color:#9ca3af;text-align:center;margin:0 0 20px 0;">
        &#9200; This code expires in <strong style="color:#dc2626;">10 minutes</strong>
      </p>
      <div style="background-color:#fffbeb;border-left:4px solid #f59e0b;padding:14px 18px;border-radius:6px;">
        <p style="font-size:13px;color:#92400e;margin:0;">
          <strong>&#128272; Security notice:</strong> Never share this code. Our team will never ask for it.
        </p>
      </div>
    `,
    footerNote: 'Need help? Email support@drinksharbour.com',
  });

  return sendEmail({
    to: email,
    subject: '&#9989; Verify Your Email - DrinksHarbour',
    html,
  });
};

const sendGiftCardEmail = async (to, { amount, senderName, message, expiresAt, claimLink }) => {
  const formattedAmount = new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: 'NGN', maximumFractionDigits: 0,
  }).format(amount);

  const expiryStr = expiresAt
    ? new Date(expiresAt).toLocaleDateString('en-NG', { dateStyle: 'long' })
    : 'in 12 months';

  const body = `
    <div style="text-align:center;padding:24px 0 8px;">
      <p style="font-size:15px;color:#57534e;margin:0 0 4px 0;">
        <strong style="color:#1c1917;">${senderName || 'Someone'}</strong> sent you a gift card!
      </p>
      <p style="font-size:40px;font-weight:900;color:#c0392b;margin:8px 0 20px 0;">${formattedAmount}</p>
      ${message ? `
      <blockquote style="border-left:3px solid #c0392b;margin:0 auto 24px;padding:10px 16px;font-style:italic;color:#44403c;max-width:340px;text-align:left;">
        &ldquo;${message}&rdquo;
      </blockquote>` : ''}
      <p style="font-size:13px;color:#78716c;margin:0 0 28px 0;">
        Redeemable at any store on DrinksHarbour. Expires ${expiryStr}.
      </p>
      <a href="${claimLink}"
         style="display:inline-block;background:#c0392b;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 36px;border-radius:8px;">
        Claim Your Gift
      </a>
      <p style="font-size:11px;color:#a8a29e;margin:20px 0 0 0;">
        Or copy this link into your browser:<br/>${claimLink}
      </p>
    </div>
  `;

  const html = emailShell({
    accentColor: '#c0392b',
    accentLabel: `You received a gift card worth ${formattedAmount}`,
    accentSubtitle: `From ${senderName || 'a friend'} on DrinksHarbour`,
    body,
    footerNote: 'Need help? Email support@drinksharbour.com',
  });

  return sendEmail({
    to,
    subject: `🎁 ${senderName || 'Someone'} sent you a ${formattedAmount} DrinksHarbour gift card!`,
    html,
  });
};

// ─── 10. Tenant application — confirmation to applicant ──────────────────────

const sendTenantApplicationReceivedEmail = async ({ email, firstName, businessName, slug, plan }) => {
  if (!emailServiceReady) {
    console.log('⚠️  Email service not ready, skipping application confirmation email');
    return { success: false, message: 'Email service not configured' };
  }

  const planLabel = {
    free_trial: 'Free Trial', starter: 'Starter', growth: 'Growth',
    pro: 'Pro', enterprise: 'Enterprise', venue: 'Venue',
  }[plan] || 'Free Trial';

  const html = emailShell({
    accentColor:    '#16a34a',
    accentLabel:    '&#9989; Application Received',
    accentSubtitle: `${businessName} · ${planLabel} Plan`,
    body: `
      <p style="font-size:16px;color:#374151;margin:0 0 16px 0;">Hello <strong>${firstName || 'there'}</strong>,</p>
      <p style="font-size:14px;color:#6b7280;line-height:1.7;margin:0 0 24px 0;">
        Thank you for applying to sell on DrinksHarbour! We've received your application for
        <strong>${businessName}</strong> on the <strong>${planLabel}</strong> plan.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;background:#f9fafb;border-radius:12px;">
        <tr>
          <td style="padding:20px;">
            <p style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px 0;">What happens next?</p>
            <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 8px 0;"><strong>1.</strong> Our team reviews your application within 48 hours.</p>
            <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 8px 0;"><strong>2.</strong> We verify your business details and documents.</p>
            <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 8px 0;"><strong>3.</strong> Once approved, you'll receive an email with login instructions.</p>
            <p style="font-size:14px;color:#374151;line-height:1.6;margin:0;"><strong>4.</strong> Set your password and start adding products!</p>
          </td>
        </tr>
      </table>
      <p style="font-size:13px;color:#9ca3af;margin:0;">
        Your store URL will be: <strong style="color:#374151;">drinksharbour.com/vendors/${slug}</strong>
      </p>
    `,
    footerNote: 'Questions? Email support@drinksharbour.com',
  });

  return sendEmail({
    to: email,
    subject: `&#9989; Application Received — ${businessName} | DrinksHarbour`,
    html,
  });
};

// ─── 11. Tenant application — notification to admin ───────────────────────────

const sendTenantApplicationNotificationToAdmin = async ({
  businessName, slug, contactName, email, phone, businessType, plan, city, state,
  kycVerified = false, kycChecks = [], kycWarnings = [], kycNameCrossCheck,
}) => {
  if (!emailServiceReady) {
    console.log('⚠️  Email service not ready, skipping admin notification');
    return { success: false, message: 'Email service not configured' };
  }

  const adminEmail = process.env.ADMIN_EMAIL || process.env.SENDER_EMAIL_ADDRESS;
  if (!adminEmail) {
    console.log('⚠️  Admin email not configured, skipping admin notification');
    return { success: false, message: 'Admin email not configured' };
  }

  const planLabel = {
    free_trial: 'Free Trial', starter: 'Starter', growth: 'Growth',
    pro: 'Pro', enterprise: 'Enterprise', venue: 'Venue',
  }[plan] || 'Free Trial';

  const html = emailShell({
    accentColor:    '#dc2626',
    accentLabel:    '&#128276; New Vendor Application',
    accentSubtitle: `${businessName} · ${planLabel} Plan`,
    body: `
      <p style="font-size:16px;color:#374151;margin:0 0 16px 0;">A new vendor application has been submitted.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr><td style="padding:8px 0;font-size:14px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Business</td>
        <td style="padding:8px 0;font-size:14px;color:#111827;font-weight:600;text-align:right;border-bottom:1px solid #e5e7eb;">${businessName}</td></tr>
        <tr><td style="padding:8px 0;font-size:14px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Type</td>
        <td style="padding:8px 0;font-size:14px;color:#111827;font-weight:600;text-align:right;border-bottom:1px solid #e5e7eb;">${businessType || '—'}</td></tr>
        <tr><td style="padding:8px 0;font-size:14px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Contact</td>
        <td style="padding:8px 0;font-size:14px;color:#111827;font-weight:600;text-align:right;border-bottom:1px solid #e5e7eb;">${contactName || '—'}</td></tr>
        <tr><td style="padding:8px 0;font-size:14px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Email</td>
        <td style="padding:8px 0;font-size:14px;color:#111827;font-weight:600;text-align:right;border-bottom:1px solid #e5e7eb;">${email}</td></tr>
        <tr><td style="padding:8px 0;font-size:14px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Phone</td>
        <td style="padding:8px 0;font-size:14px;color:#111827;font-weight:600;text-align:right;border-bottom:1px solid #e5e7eb;">${phone || '—'}</td></tr>
        <tr><td style="padding:8px 0;font-size:14px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Location</td>
        <td style="padding:8px 0;font-size:14px;color:#111827;font-weight:600;text-align:right;border-bottom:1px solid #e5e7eb;">${city || '—'}, ${state || '—'}</td></tr>
        <tr><td style="padding:8px 0;font-size:14px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Plan</td>
        <td style="padding:8px 0;font-size:14px;color:#111827;font-weight:600;text-align:right;border-bottom:1px solid #e5e7eb;">${planLabel}</td></tr>
        <tr><td style="padding:8px 0;font-size:14px;color:#6b7280;">Store URL</td>
        <td style="padding:8px 0;font-size:14px;color:#111827;font-weight:600;text-align:right;">drinksharbour.com/vendors/${slug}</td></tr>
      </table>

      ${kycChecks.length > 0 ? `
      <p style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px 0;">External KYC Verification</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;background:${kycVerified ? '#f0fdf4' : '#fef3c7'};border-radius:12px;">
        <tr><td style="padding:16px;">
          <p style="font-size:14px;font-weight:600;color:${kycVerified ? '#15803d' : '#b45309'};margin:0 0 10px 0;">
            ${kycVerified ? '&#9989; KYC Verified' : '&#9888; KYC Issues Found'}
            ${kycNameCrossCheck?.performed ? ` &mdash; Name match: ${kycNameCrossCheck.allPassed ? '&#9989; All passed' : '&#9888; ' + (kycNameCrossCheck.hasWarnings ? 'Warnings' : 'Failed')}` : ''}
          </p>
          ${kycChecks.map((c) => `
            <p style="font-size:13px;color:#374151;margin:0 0 6px 0;">
              ${c.passed ? '&#10004;' : c.skipped ? '&#9986;' : '&#10006;'} <strong>${c.check}:</strong> ${c.detail}
            </p>
          `).join('')}
          ${kycWarnings.length > 0 ? `
            <p style="font-size:13px;color:#b45309;margin:10px 0 0 0;">
              <strong>Warnings:</strong> ${kycWarnings.join('; ')}
            </p>
          ` : ''}
        </td></tr>
      </table>
      ` : ''}

      <p style="font-size:13px;color:#9ca3af;margin:0;">
        Review this application in the admin dashboard. Approve or reject to proceed.
      </p>
    `,
    footerNote: 'Admin Notification — DrinksHarbour Platform',
  });

  return sendEmail({
    to: adminEmail,
    subject: `[Admin] New Vendor Application — ${businessName} (${planLabel})`,
    html,
  });
};

module.exports = {
  sendEmail,
  sendOrderConfirmationToCustomer,
  sendNewOrderNotificationToTenant,
  sendNewOrderNotificationToAdmin,
  sendVerificationCodeEmail,
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
  sendPurchaseOrderToVendor,
  sendGiftCardEmail,
  sendTenantApplicationReceivedEmail,
  sendTenantApplicationNotificationToAdmin,
};

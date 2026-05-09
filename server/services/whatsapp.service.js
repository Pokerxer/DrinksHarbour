// services/whatsapp.service.js
// WhatsApp Cloud API outbound messaging (Meta Business Platform)
//
// Required .env vars:
//   WHATSAPP_ACCESS_TOKEN      – permanent system-user token from Meta Business Suite
//   WHATSAPP_PHONE_NUMBER_ID   – Phone Number ID from Meta Developer dashboard
//
// Optional:
//   WHATSAPP_API_VERSION       – Graph API version, defaults to v19.0

const https = require('https');

const ACCESS_TOKEN    = process.env.WHATSAPP_ACCESS_TOKEN    || '';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const API_VERSION     = process.env.WHATSAPP_API_VERSION     || 'v19.0';

// ── Status tracking ───────────────────────────────────────────────────────────

let whatsappReady = false;

const initializeWhatsAppService = () => {
  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
    console.log('⚠️  WhatsApp service not configured — set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in .env');
    return;
  }
  whatsappReady = true;
  console.log('✅ WhatsApp service initialized (Meta Cloud API)');
};

initializeWhatsAppService();

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n || 0);

/**
 * Strip markdown so WhatsApp receives plain text.
 */
function stripMarkdown(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

/**
 * Normalise a Nigerian phone number to international format (234XXXXXXXXXX).
 */
function normalisePhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('234') && digits.length === 13) return digits;
  if (digits.startsWith('0')   && digits.length === 11) return `234${digits.slice(1)}`;
  if (digits.length === 10) return `234${digits}`;
  return digits;
}

// ── Core send function ────────────────────────────────────────────────────────

/**
 * Send a WhatsApp text message via Meta Cloud API.
 *
 * @param {string} to   - Recipient phone (international format, e.g. 2348012345678)
 * @param {string} text - Message text (max 4096 chars)
 * @returns {Promise<{ success: boolean; messageId?: string; error?: string }>}
 */
function sendWhatsAppMessage(to, text) {
  if (!whatsappReady) {
    console.log('[WhatsApp] Dev mode — would send to', to, ':', text.slice(0, 80));
    return Promise.resolve({ success: true, messageId: 'dev-mode' });
  }

  return new Promise((resolve) => {
    const body = JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    });

    const req = https.request(
      {
        hostname: 'graph.facebook.com',
        path:     `/${API_VERSION}/${PHONE_NUMBER_ID}/messages`,
        method:   'POST',
        headers: {
          Authorization:   `Bearer ${ACCESS_TOKEN}`,
          'Content-Type':  'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 400) {
              const errMsg = parsed?.error?.message || data;
              console.error('[WhatsApp] API error:', errMsg);
              resolve({ success: false, error: errMsg });
            } else {
              const messageId = parsed?.messages?.[0]?.id;
              console.log(`[WhatsApp] Sent to ${to} — messageId: ${messageId}`);
              resolve({ success: true, messageId });
            }
          } catch {
            resolve({ success: false, error: 'Failed to parse response' });
          }
        });
      }
    );

    req.on('error', (err) => {
      console.error('[WhatsApp] Request error:', err.message);
      resolve({ success: false, error: err.message });
    });

    req.setTimeout(12000, () => {
      req.destroy();
      resolve({ success: false, error: 'Request timeout' });
    });

    req.write(body);
    req.end();
  });
}

/**
 * Send a long message, splitting at 4000-char boundaries.
 */
async function sendWhatsAppLongMessage(to, text) {
  const plain  = stripMarkdown(text);
  const chunks = [];
  for (let i = 0; i < plain.length; i += 4000) chunks.push(plain.slice(i, i + 4000));

  let lastResult = { success: true };
  for (const chunk of chunks) {
    lastResult = await sendWhatsAppMessage(to, chunk);
    if (!lastResult.success) break;
  }
  return lastResult;
}

// ── Notification templates ────────────────────────────────────────────────────

/**
 * Order confirmation sent to customer right after checkout.
 */
async function sendOrderConfirmationWhatsApp(order, customer) {
  const phone = normalisePhone(customer?.phone || order?.shippingAddress?.phone);
  if (!phone) return;

  const name   = customer?.firstName || customer?.name || 'Customer';
  const num    = order.orderNumber || order._id?.toString().slice(-8).toUpperCase();
  const total  = fmt(order.totalAmount || order.total);
  const items  = order.items?.length || 0;

  const msg =
    `🎉 *Order Confirmed!*\n\n` +
    `Hi ${name}, thank you for shopping with DrinksHarbour!\n\n` +
    `*Order:* #${num}\n` +
    `*Items:* ${items} item${items !== 1 ? 's' : ''}\n` +
    `*Total:* ${total}\n\n` +
    `We'll notify you once your order is on its way. You can track your order at:\n` +
    `drinksharbour.com/order-tracking\n\n` +
    `Questions? Reply to this message and we'll help. 🍷`;

  return sendWhatsAppLongMessage(phone, msg);
}

/**
 * Order status update WhatsApp message.
 */
async function sendOrderStatusWhatsApp(order, customer, newStatus) {
  const phone = normalisePhone(customer?.phone || order?.shippingAddress?.phone);
  if (!phone) return;

  const name = customer?.firstName || customer?.name || 'Customer';
  const num  = order.orderNumber || order._id?.toString().slice(-8).toUpperCase();

  const statusEmoji = {
    confirmed:  '✅',
    processing: '📦',
    shipped:    '🚚',
    delivered:  '🎉',
    cancelled:  '❌',
  };

  const statusText = {
    confirmed:  `Your order #${num} has been confirmed and is being prepared.`,
    processing: `Your order #${num} is now being packed and processed.`,
    shipped:    `Great news! Your order #${num} has been shipped and is on its way to you.`,
    delivered:  `Your order #${num} has been delivered! We hope you enjoy your drinks. 🥂`,
    cancelled:  `Your order #${num} has been cancelled. If this is unexpected, please contact us immediately.`,
  };

  const emoji = statusEmoji[newStatus?.toLowerCase()] || '📬';
  const body  = statusText[newStatus?.toLowerCase()] || `Your order #${num} status has been updated to: ${newStatus}.`;

  const msg =
    `${emoji} *Order Update*\n\n` +
    `Hi ${name},\n\n` +
    `${body}\n\n` +
    `Track your order: drinksharbour.com/order-tracking\n\n` +
    `Need help? Reply here or call us.`;

  return sendWhatsAppLongMessage(phone, msg);
}

/**
 * New order alert sent to a vendor/tenant.
 */
async function sendNewOrderAlertWhatsApp(order, tenant) {
  const phone = normalisePhone(tenant?.phone || tenant?.whatsapp);
  if (!phone) return;

  const num   = order.orderNumber || order._id?.toString().slice(-8).toUpperCase();
  const items = order.items?.filter(i => {
    const tid = i.tenant?._id?.toString() || i.tenant?.toString();
    return tid === tenant._id?.toString();
  }) || order.items || [];
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  const msg =
    `🛒 *New Order — Action Required*\n\n` +
    `*Order:* #${num}\n` +
    `*Items to fulfil:* ${itemCount}\n\n` +
    `Please log in to your dashboard to confirm and prepare this order.\n` +
    `drinksharbour.com/vendor/orders\n\n` +
    `DrinksHarbour Operations`;

  return sendWhatsAppLongMessage(phone, msg);
}

/**
 * OTP / verification code via WhatsApp.
 */
async function sendVerificationWhatsApp(phone, code, firstName) {
  const normPhone = normalisePhone(phone);
  if (!normPhone) return;

  const name = firstName || 'there';
  const msg =
    `🔐 *DrinksHarbour Verification*\n\n` +
    `Hi ${name}, your one-time verification code is:\n\n` +
    `*${code}*\n\n` +
    `This code expires in 10 minutes. Do not share it with anyone.`;

  return sendWhatsAppMessage(normPhone, msg);
}

module.exports = {
  sendWhatsAppMessage,
  sendWhatsAppLongMessage,
  sendOrderConfirmationWhatsApp,
  sendOrderStatusWhatsApp,
  sendNewOrderAlertWhatsApp,
  sendVerificationWhatsApp,
  normalisePhone,
  stripMarkdown,
  isWhatsAppReady: () => whatsappReady,
};

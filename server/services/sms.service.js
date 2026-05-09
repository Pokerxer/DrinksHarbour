// services/sms.service.js
// SMS via Termii (Nigeria-focused SMS gateway — https://termii.com)
//
// Required .env vars:
//   TERMII_API_KEY        – your Termii API key
//   TERMII_SENDER_ID      – approved Sender ID (e.g. "DrinkHarbr") max 11 chars
//
// Optional:
//   TERMII_BASE_URL       – defaults to https://v3.api.termii.com

const axios = require('axios');

const TERMII_BASE_URL = process.env.TERMII_BASE_URL || 'https://v3.api.termii.com';
const TERMII_API_KEY  = process.env.TERMII_API_KEY  || '';
const TERMII_SENDER   = process.env.TERMII_SENDER_ID || 'DrinksHbr';

// ── Status tracking ───────────────────────────────────────────────────────────

let smsServiceReady = false;

const initializeSmsService = () => {
  if (!TERMII_API_KEY) {
    console.log('⚠️  SMS service not configured — set TERMII_API_KEY in .env');
    return;
  }
  smsServiceReady = true;
  console.log('✅ SMS service initialized (Termii)');
};

initializeSmsService();

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalise a Nigerian phone number to international format (234XXXXXXXXXX).
 * Accepts: 08012345678 / +2348012345678 / 2348012345678 / 8012345678
 */
function normalisePhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('234') && digits.length === 13) return digits;
  if (digits.startsWith('0')   && digits.length === 11) return `234${digits.slice(1)}`;
  if (digits.length === 10) return `234${digits}`;
  return digits;
}

const fmt = (n) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n || 0);

// ── Core send function ────────────────────────────────────────────────────────

/**
 * Send a plain-text SMS via Termii.
 *
 * @param {string} to   - Recipient phone number (any common Nigerian format)
 * @param {string} text - Message text (max 160 chars per segment)
 * @returns {Promise<{ success: boolean; messageId?: string; error?: string }>}
 */
async function sendSMS(to, text) {
  const phone = normalisePhone(to);

  if (!phone) {
    console.warn('[SMS] Invalid phone number:', to);
    return { success: false, error: 'Invalid phone number' };
  }

  if (!smsServiceReady) {
    console.log('[SMS] Dev mode — would send to', phone, ':', text);
    return { success: true, messageId: 'dev-mode' };
  }

  try {
    const response = await axios.post(
      `${TERMII_BASE_URL}/api/sms/send`,
      {
        to:      phone,
        from:    TERMII_SENDER,
        sms:     text,
        type:    'plain',
        api_key: TERMII_API_KEY,
        channel: 'generic',
      },
      { timeout: 15000 }
    );

    const data = response.data;

    // Termii returns { code: 'ok', message_id: '...', ... } on success
    if (data?.code === 'ok' || data?.message_id) {
      console.log(`[SMS] Sent to ${phone} — messageId: ${data.message_id}`);
      return { success: true, messageId: data.message_id };
    }

    // Handle Termii error responses
    console.error('[SMS] Termii error:', JSON.stringify(data));
    return { success: false, error: data?.message || 'Unknown Termii error' };

  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    console.error('[SMS] Send failed:', msg);
    return { success: false, error: msg };
  }
}

// ── Notification templates ────────────────────────────────────────────────────

/**
 * Order confirmation SMS sent to the customer right after checkout.
 */
async function sendOrderConfirmationSMS(order, customer) {
  const phone = customer?.phone || order?.shippingAddress?.phone;
  if (!phone) return;

  const name  = customer?.firstName || customer?.name || 'Customer';
  const num   = order.orderNumber || order._id?.toString().slice(-8).toUpperCase();
  const total = fmt(order.totalAmount || order.total);

  const text =
    `Hi ${name}, your DrinksHarbour order #${num} for ${total} has been received!\n` +
    `We'll update you when it ships. Track at drinksharbour.com/order-tracking\n` +
    `Questions? WhatsApp us: +2348000000000`;

  return sendSMS(phone, text);
}

/**
 * Order status update SMS (shipped, delivered, etc.).
 */
async function sendOrderStatusSMS(order, customer, newStatus) {
  const phone = customer?.phone || order?.shippingAddress?.phone;
  if (!phone) return;

  const name = customer?.firstName || customer?.name || 'Customer';
  const num  = order.orderNumber || order._id?.toString().slice(-8).toUpperCase();

  const statusMessages = {
    confirmed:  `Hi ${name}, your order #${num} has been confirmed and is being prepared.`,
    processing: `Hi ${name}, your order #${num} is now being processed and packed.`,
    shipped:    `Hi ${name}, great news! Order #${num} is on its way. Expect delivery soon.`,
    delivered:  `Hi ${name}, your order #${num} has been delivered! Enjoy your drinks. 🥂`,
    cancelled:  `Hi ${name}, your order #${num} has been cancelled. Contact support if this is unexpected.`,
  };

  const text = (statusMessages[newStatus?.toLowerCase()] || `Hi ${name}, your order #${num} status has been updated to: ${newStatus}.`) +
    `\nTrack: drinksharbour.com/order-tracking`;

  return sendSMS(phone, text);
}

/**
 * OTP / verification code SMS.
 */
async function sendVerificationSMS(phone, code, firstName) {
  const name = firstName || 'there';
  const text = `Hi ${name}, your DrinksHarbour verification code is: ${code}\nExpires in 10 minutes. Don't share this with anyone.`;
  return sendSMS(phone, text);
}

/**
 * Password reset OTP.
 */
async function sendPasswordResetSMS(phone, code) {
  const text = `Your DrinksHarbour password reset code is: ${code}\nValid for 10 minutes. Ignore if you didn't request this.`;
  return sendSMS(phone, text);
}

module.exports = {
  sendSMS,
  sendOrderConfirmationSMS,
  sendOrderStatusSMS,
  sendVerificationSMS,
  sendPasswordResetSMS,
  normalisePhone,
  isSmsReady: () => smsServiceReady,
};

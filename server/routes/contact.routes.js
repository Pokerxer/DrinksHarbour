// routes/contact.routes.js

const express      = require('express');
const router       = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const { sendEmail } = require('../services/email.service');

const ADMIN_EMAIL   = process.env.ADMIN_EMAIL   || 'support@drinksharbour.com';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || ADMIN_EMAIL;

const SUBJECTS = {
  order:    'Order Issue',
  delivery: 'Delivery Enquiry',
  product:  'Product Question',
  vendor:   'Vendor / Partnership',
  payment:  'Payment Problem',
  returns:  'Returns & Refunds',
  other:    'General Enquiry',
};

/**
 * @route  POST /api/contact
 * @desc   Submit a contact form — sends email to support + auto-reply to sender
 * @access Public
 */
router.post('/', asyncHandler(async (req, res) => {
  const { name, email, phone, subject, message, orderNumber } = req.body;

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return res.status(400).json({ success: false, message: 'Name, email, and message are required.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
  }

  if (message.trim().length < 10) {
    return res.status(400).json({ success: false, message: 'Message must be at least 10 characters.' });
  }

  const subjectLabel = SUBJECTS[subject] || subject || 'General Enquiry';
  const now = new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos', dateStyle: 'medium', timeStyle: 'short' });

  // ── Email to support team ────────────────────────────────────────────────────
  const adminHtml = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
      <div style="background:linear-gradient(135deg,#b91c1c,#7f1d1d);padding:28px 32px">
        <h1 style="color:#fff;margin:0;font-size:20px">📬 New Contact Form Submission</h1>
        <p style="color:#fca5a5;margin:6px 0 0;font-size:13px">${now}</p>
      </div>
      <div style="padding:28px 32px">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;width:130px">Name</td>
              <td style="padding:8px 0;color:#111827;font-weight:600">${name}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Email</td>
              <td style="padding:8px 0"><a href="mailto:${email}" style="color:#b91c1c">${email}</a></td></tr>
          ${phone ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Phone</td>
              <td style="padding:8px 0;color:#111827">${phone}</td></tr>` : ''}
          <tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Subject</td>
              <td style="padding:8px 0;color:#111827">${subjectLabel}</td></tr>
          ${orderNumber ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Order #</td>
              <td style="padding:8px 0;color:#111827;font-family:monospace">${orderNumber}</td></tr>` : ''}
        </table>
        <div style="margin-top:20px;padding:16px;background:#fef2f2;border-left:3px solid #b91c1c;border-radius:6px">
          <p style="margin:0;color:#374151;font-size:14px;line-height:1.6;white-space:pre-wrap">${message.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
        </div>
        <div style="margin-top:20px;text-align:center">
          <a href="mailto:${email}?subject=Re: ${encodeURIComponent(subjectLabel)}"
             style="display:inline-block;padding:12px 28px;background:#b91c1c;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
            Reply to ${name}
          </a>
        </div>
      </div>
    </div>`;

  // ── Auto-reply to sender ────────────────────────────────────────────────────
  const autoReplyHtml = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
      <div style="background:linear-gradient(135deg,#b91c1c,#7f1d1d);padding:28px 32px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:22px;letter-spacing:-0.5px">DrinksHarbour</h1>
        <p style="color:#fca5a5;margin:6px 0 0;font-size:13px">Premium Beverages · Nigeria</p>
      </div>
      <div style="padding:32px">
        <h2 style="color:#111827;font-size:18px;margin:0 0 12px">Hi ${name}, we got your message! 👋</h2>
        <p style="color:#6b7280;font-size:14px;line-height:1.7;margin:0 0 20px">
          Thanks for reaching out about <strong>${subjectLabel}</strong>. Our support team has received your message and will get back to you within <strong>24 hours</strong> on business days.
        </p>
        <div style="background:#fef2f2;border-radius:10px;padding:16px 20px;margin-bottom:24px">
          <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:.5px">Your message</p>
          <p style="margin:0;color:#374151;font-size:14px;line-height:1.6;white-space:pre-wrap">${message.replace(/</g,'&lt;').replace(/>/g,'&gt;').slice(0, 300)}${message.length > 300 ? '…' : ''}</p>
        </div>
        <p style="color:#6b7280;font-size:14px;line-height:1.7;margin:0 0 8px">In the meantime, you can:</p>
        <ul style="color:#6b7280;font-size:14px;line-height:2;padding-left:20px;margin:0 0 24px">
          <li>Check your <a href="https://drinksharbour.com/order-tracking" style="color:#b91c1c">order status</a></li>
          <li>Browse our <a href="https://drinksharbour.com/faqs" style="color:#b91c1c">FAQs</a></li>
          <li>Chat with us on <a href="https://wa.me/${process.env.WHATSAPP_BUSINESS_PHONE || '2348000000000'}" style="color:#25D366;font-weight:600">WhatsApp</a></li>
        </ul>
        <div style="text-align:center;margin-top:8px">
          <a href="https://drinksharbour.com/shop"
             style="display:inline-block;padding:13px 32px;background:linear-gradient(135deg,#b91c1c,#7f1d1d);color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;letter-spacing:.3px">
            Continue Shopping →
          </a>
        </div>
      </div>
      <div style="padding:20px 32px;background:#fafafa;border-top:1px solid #f3f4f6;text-align:center">
        <p style="margin:0;color:#9ca3af;font-size:12px">
          DrinksHarbour · Abuja, Nigeria ·
          <a href="mailto:support@drinksharbour.com" style="color:#b91c1c">support@drinksharbour.com</a>
        </p>
      </div>
    </div>`;

  // Send both emails concurrently (don't fail the request if email fails)
  await Promise.allSettled([
    sendEmail({
      to: SUPPORT_EMAIL,
      subject: `[Contact] ${subjectLabel} — ${name}`,
      html: adminHtml,
    }),
    sendEmail({
      to: email,
      subject: `We received your message — DrinksHarbour`,
      html: autoReplyHtml,
    }),
  ]);

  res.json({
    success: true,
    message: 'Message sent! We\'ll get back to you within 24 hours.',
  });
}));

module.exports = router;

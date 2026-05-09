// routes/whatsapp.routes.js
// WhatsApp Cloud API webhook for DrinksHarbour
//
// Required env vars:
//   WHATSAPP_VERIFY_TOKEN   – any string you set in Meta's webhook config
//   WHATSAPP_ACCESS_TOKEN   – permanent system-user token from Meta Business
//   WHATSAPP_PHONE_NUMBER_ID – the Phone Number ID from Meta's WhatsApp dashboard

const express  = require('express');
const router   = express.Router();
const { handleChatbotQuery } = require('../services/chatbot.service');
const {
  sendWhatsAppMessage,
  sendWhatsAppLongMessage,
  stripMarkdown,
} = require('../services/whatsapp.service');

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'drinksharbour_verify';

// In-memory per-user conversation history (cleared after 30 min of inactivity)
const sessions    = new Map(); // waId → { history: [], lastSeen: timestamp }
const SESSION_TTL = 30 * 60 * 1000;

function getSession(waId) {
  const now = Date.now();
  // Expire old sessions
  for (const [id, s] of sessions) {
    if (now - s.lastSeen > SESSION_TTL) sessions.delete(id);
  }
  if (!sessions.has(waId)) sessions.set(waId, { history: [], lastSeen: now });
  const session = sessions.get(waId);
  session.lastSeen = now;
  return session;
}

// ── GET /api/whatsapp/webhook — Meta verification challenge ───────────────────
router.get('/webhook', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[WhatsApp] Webhook verified');
    return res.status(200).send(challenge);
  }
  console.warn('[WhatsApp] Verification failed — token mismatch');
  res.sendStatus(403);
});

// ── POST /api/whatsapp/webhook — Incoming messages from Meta ─────────────────
router.post('/webhook', async (req, res) => {
  // Always acknowledge immediately — Meta retries if we don't respond within 20 s
  res.sendStatus(200);

  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue;

        const value    = change.value;
        const messages = value?.messages || [];

        for (const msg of messages) {
          // Only handle text messages for now
          if (msg.type !== 'text') continue;

          const waId     = msg.from;
          const userText = msg.text?.body?.trim();
          if (!userText) continue;

          console.log(`[WhatsApp] Message from ${waId}: ${userText.slice(0, 80)}`);

          const session = getSession(waId);

          let responseText = "Sorry, I couldn't process that right now. Please try again.";
          try {
            const result = await handleChatbotQuery({
              query: userText,
              conversationHistory: session.history.slice(-10),
            });

            responseText = result?.response || result?.data?.response || responseText;

            session.history.push(
              { role: 'user',      content: userText },
              { role: 'assistant', content: responseText },
            );
            if (session.history.length > 20) session.history = session.history.slice(-20);

            // Append product names if included
            const products = result?.products || result?.data?.products;
            if (products?.length) {
              const list = products.slice(0, 5).map((p, i) =>
                `${i + 1}. ${p.name} — ₦${(p.minPrice || 0).toLocaleString()}`
              ).join('\n');
              responseText += `\n\n🍷 *Products:*\n${list}\n\nShop at drinksharbour.com`;
            }
          } catch (err) {
            console.error('[WhatsApp] Chatbot error:', err.message);
          }

          // Send reply — split long messages and strip markdown
          await sendWhatsAppLongMessage(waId, responseText).catch(e => {
            console.error('[WhatsApp] Failed to send reply:', e.message);
          });
        }
      }
    }
  } catch (err) {
    console.error('[WhatsApp] Webhook handler error:', err);
  }
});

module.exports = router;

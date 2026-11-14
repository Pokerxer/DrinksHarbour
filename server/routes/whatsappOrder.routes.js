// server/routes/whatsappOrder.routes.js
'use strict';
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { protect, superAdminOnly } = require('../middleware/auth.middleware');
const controller = require('../controllers/whatsappOrder.controller');

// Local-memory limiters only (standalone-runtime agreement — no Redis).
const issueLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
const verifyLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });

// Issuance is a privileged platform action.
router.post('/:id/invoice', protect, superAdminOnly, issueLimiter, controller.issueInvoice);

// The invoice page and its settlement are customer-facing, gated by token.
router.get('/:id/invoice', controller.getInvoice);
router.post('/:id/pay-verify', verifyLimiter, controller.verifyPayment);

module.exports = router;

// server/routes/scan.routes.js
//
// Scan & Match API for the Sales create page. Desktop endpoints (pair / status
// / match) require the admin JWT + tenant context. The mobile upload endpoint
// authorizes with the pairing code alone (the phone isn't logged in).

const express = require('express');
const router = express.Router();
const { protect, attachTenant } = require('../middleware/auth.middleware');
const { uploadSingleImage } = require('../middleware/imageUpload.middleware');
const scanController = require('../controllers/scan.controller');

// ── Mobile upload (pairing code, NO JWT) ──────────────────────────────────
// Registered BEFORE the `protect` chain below so an unauthenticated phone can
// reach it. The controller validates the pairing code itself.
router.post(
  '/upload-mobile/:code',
  uploadSingleImage,
  scanController.mobileUpload
);

// ── Desktop endpoints (admin JWT + tenant) ──────────────────────────────────
// Everything below requires an authenticated admin user + tenant context.
router.use(protect, attachTenant);

router.post('/pair', scanController.createPairing);
router.get('/status/:code', scanController.getStatus);
router.post('/match', scanController.desktopMatch);

module.exports = router;
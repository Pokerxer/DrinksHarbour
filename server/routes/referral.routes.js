// server/routes/referral.routes.js
//
// The customer's own referrals. Self-scoped to the JWT user; there is no
// cross-user access and no admin surface here.

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const referralController = require('../controllers/referral.controller');

router.use(protect);

// GET /api/referrals — code, share link, terms, totals, recent referrals
router.get('/', referralController.getReferrals);

module.exports = router;
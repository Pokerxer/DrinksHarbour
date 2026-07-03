// server/routes/loyalty.routes.js
//
// Platform-wide "Corks & Points" loyalty (account "Loyalty" page). Points are
// earned per NGN spent at checkout and redeemed into the platform wallet; never
// redeemable for cash. Self-scoped to the JWT user.

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const { body } = require('express-validator');
const loyaltyController = require('../controllers/loyalty.controller');

router.use(protect);

// GET /api/loyalty — balance, tier, progress, recent activity
router.get('/', loyaltyController.getLoyalty);

// GET /api/loyalty/transactions — paginated ledger
router.get('/transactions', loyaltyController.getLoyaltyTransactions);

// POST /api/loyalty/redeem — convert points → wallet credit
router.post(
  '/redeem',
  [body('points').isInt({ min: 1 }).withMessage('Points must be a positive whole number')],
  validate,
  loyaltyController.redeemLoyaltyPoints
);

// POST /api/loyalty/referral-code — issue/return the customer's referral code
router.post('/referral-code', loyaltyController.getOrCreateReferralCode);

// POST /api/loyalty/apply-referral — apply a referral code (one-time)
router.post(
  '/apply-referral',
  [body('code').notEmpty().withMessage('Referral code is required')],
  validate,
  loyaltyController.applyReferralCode
);

module.exports = router;
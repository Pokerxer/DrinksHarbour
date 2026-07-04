// server/routes/giftCardClaim.routes.js
//
// Public claim endpoints — mounted at /api/gift-cards/claim BEFORE the protected
// giftcard router. GET is fully public (optionalProtect so req.user is available
// if the caller happens to be logged in). POST requires full auth.

const express = require('express');
const router = express.Router();
const { protect, optionalProtect } = require('../middleware/auth.middleware');
const { param } = require('express-validator');
const { validate } = require('../middleware/validation.middleware');
const { getGiftCardByClaimToken, claimGiftCard } = require('../controllers/giftcard.controller');

// GET /api/gift-cards/claim/:token — public, returns card art info (no code/balance)
router.get(
  '/:token',
  optionalProtect,
  [param('token').notEmpty().withMessage('Token is required')],
  validate,
  getGiftCardByClaimToken
);

// POST /api/gift-cards/claim/:token — authenticated; claims the card for the logged-in user
router.post(
  '/:token',
  protect,
  [param('token').notEmpty().withMessage('Token is required')],
  validate,
  claimGiftCard
);

module.exports = router;

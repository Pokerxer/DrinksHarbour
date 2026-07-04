// server/routes/giftcard.routes.js
//
// Platform gift cards (account "Gift Cards" page). Purchase flow goes through
// Paystack: initialize → user pays → verify → card issued. Reads are scoped to the
// authenticated customer's own cards.

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const { body, param } = require('express-validator');
const giftCardController = require('../controllers/giftcard.controller');

router.use(protect);

// GET /api/gift-cards — list the customer's cards
router.get('/', giftCardController.getMyGiftCards);

// POST /api/gift-cards/purchase — initialize a Paystack purchase
router.post(
  '/purchase',
  [
    body('amount').isInt({ min: 1 }).withMessage('Amount must be a positive whole number'),
    body('recipient.email').optional({ checkFalsy: true }).isEmail().withMessage('Recipient email must be valid'),
    body('recipient.message').optional({ checkFalsy: true }).isLength({ max: 280 }).withMessage('Message too long'),
  ],
  validate,
  giftCardController.purchaseGiftCard
);

// POST /api/gift-cards/purchase/verify — verify payment and issue the card
router.post(
  '/purchase/verify',
  [
    body('reference').notEmpty().withMessage('Reference is required'),
    body('giftCardId').isMongoId().withMessage('Valid giftCardId is required'),
  ],
  validate,
  giftCardController.verifyPurchaseGiftCard
);

// GET /api/gift-cards/:id — get one card + its ledger
router.get(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid gift card ID')],
  validate,
  giftCardController.getGiftCard
);

// POST /api/gift-cards/:id/complete-payment — re-verify Paystack for a pending card
router.post(
  '/:id/complete-payment',
  [param('id').isMongoId().withMessage('Invalid gift card ID')],
  validate,
  giftCardController.completeGiftCardPayment
);

// GET /api/gift-cards/check?code=XXX — pre-flight balance check (any bearer)
router.get('/check', giftCardController.checkGiftCard);

// POST /api/gift-cards/pay-checkout — pay at checkout with a gift card code
router.post(
  '/pay-checkout',
  [
    body('code').notEmpty().withMessage('Gift card code is required'),
    body('amount').isInt({ min: 1 }).withMessage('Amount must be a positive integer'),
  ],
  validate,
  giftCardController.payWithGiftCard
);

// POST /api/gift-cards/:id/redeem — redeem a card the customer owns into their wallet
router.post(
  '/:id/redeem',
  [
    param('id').isMongoId().withMessage('Invalid gift card ID'),
    body('amount').isInt({ min: 1 }).withMessage('Amount must be a positive whole number'),
  ],
  validate,
  giftCardController.redeemMyGiftCard
);

// POST /api/gift-cards/:id/send-gift — set/update recipient and send the gift email
router.post(
  '/:id/send-gift',
  [
    param('id').isMongoId().withMessage('Invalid gift card ID'),
    body('email').isEmail().withMessage('Recipient email must be valid'),
    body('name').optional({ checkFalsy: true }).isLength({ max: 100 }).withMessage('Name too long'),
    body('message').optional({ checkFalsy: true }).isLength({ max: 280 }).withMessage('Message too long'),
  ],
  validate,
  giftCardController.sendGiftAsGift
);

module.exports = router;
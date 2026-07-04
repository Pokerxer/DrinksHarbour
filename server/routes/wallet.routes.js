// server/routes/wallet.routes.js
//
// Platform-wide customer wallet (account "Wallet" page). All endpoints are
// self-scoped to the JWT user — there is no cross-user access. Funding goes
// through Paystack: initialize → user pays → verify → atomic credit.

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const { body } = require('express-validator');
const walletController = require('../controllers/wallet.controller');

router.use(protect);

// GET /api/wallet — balance + recent activity
router.get('/', walletController.getWallet);

// GET /api/wallet/transactions — paginated ledger
router.get('/transactions', walletController.getWalletTransactions);

// POST /api/wallet/fund — initialize a Paystack funding transaction
router.post(
  '/fund',
  [
    body('amount').isInt({ min: 1 }).withMessage('Amount must be a positive whole number'),
  ],
  validate,
  walletController.fundWallet
);

// POST /api/wallet/fund/verify — verify Paystack payment and credit the wallet
router.post(
  '/fund/verify',
  [body('reference').notEmpty().withMessage('Reference is required')],
  validate,
  walletController.verifyFundWallet
);

// POST /api/wallet/pay — debit wallet for a checkout order
router.post(
  '/pay',
  [body('amount').isInt({ min: 1 }).withMessage('Amount must be a positive integer')],
  validate,
  walletController.payWithWallet
);

module.exports = router;
// server/routes/adCampaign.routes.js
// Self-serve sponsored-placement campaigns (phase 2 merchandising, Part B).
//
// Ads are an a-la-carte revenue stream for ANY paying tenant — deliberately
// NOT capability-gated (unlike manual pairings): the prepaid ad wallet itself
// is the gate, refusing activation while the balance is below the CPC tariff
// (server/services/adCampaign.service.js). Middleware chain mirrors
// contact.routes.js: protect → attachTenant → tenantAdminOrSuperAdmin.
const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { protect, attachTenant, tenantAdminOrSuperAdmin } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const c = require('../controllers/adCampaign.controller');
const { CPC_TARIFF_NGN } = require('../config/ads');

router.use(protect, attachTenant, tenantAdminOrSuperAdmin);

// GET /api/ads/campaigns — the tenant's campaigns, newest first (swept on read)
router.get('/', c.listCampaigns);

// GET /api/ads/campaigns/summary — wallet balance + CPC tariff + campaigns
// (registered before any :id-shaped route; there is no GET /:id endpoint).
router.get('/summary', c.getSummary);

// POST /api/ads/campaigns — create a draft campaign
router.post(
  '/',
  [
    body('name').isString().trim().notEmpty().withMessage('Campaign name is required')
      .isLength({ max: 120 }).withMessage('Campaign name must be 120 characters or fewer'),
    body('product').isMongoId().withMessage('A valid product is required'),
    body('surfaces').isArray({ min: 1 }).withMessage('Surfaces must be a non-empty subset of: pdp, cart'),
    body('surfaces.*').isIn(['pdp', 'cart']).withMessage('Surfaces must be a non-empty subset of: pdp, cart'),
    body('dailyBudget').isInt({ min: CPC_TARIFF_NGN })
      .withMessage(`Daily budget must be a positive integer of at least the CPC tariff (NGN ${CPC_TARIFF_NGN})`),
    body('startsAt').optional({ nullable: true }).isISO8601().withMessage('Invalid start date'),
    body('endsAt').optional({ nullable: true }).isISO8601().withMessage('Invalid end date'),
  ],
  validate,
  c.createCampaign
);

// PATCH /api/ads/campaigns/:id/status — { status: 'active' | 'paused' }
router.patch(
  '/:id/status',
  [
    param('id').isMongoId().withMessage('Valid campaign ID is required'),
    body('status').isIn(['active', 'paused']).withMessage("Status must be 'active' or 'paused'"),
  ],
  validate,
  c.updateStatus
);

// DELETE /api/ads/campaigns/:id — only draft/paused/expired (active must pause)
router.delete(
  '/:id',
  [param('id').isMongoId().withMessage('Valid campaign ID is required')],
  validate,
  c.deleteCampaign
);

module.exports = router;

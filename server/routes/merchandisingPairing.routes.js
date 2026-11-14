// server/routes/merchandisingPairing.routes.js
// Manual upsell pairings — tenant-owned module (Growth+ capability
// merchandising_manual; free_trial and starter tenants are refused by the
// plan gate, server/config/erm-plans.js).
//
// Middleware chain mirrors apiKey.routes.js: requireOwnTenant takes the
// tenant from the JWT claim ONLY (no x-tenant-slug / ?tenant= pivot, no
// admin bypass), so pairings are unreachable to platform staff and to any
// tenant other than the caller's own. requireCapability runs AFTER
// attachTenant because it reads the loaded req.tenant to resolve
// entitlements.
const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { protect, attachTenant, requireOwnTenant } = require('../middleware/auth.middleware');
const { requireCapability } = require('../middleware/plan.middleware');
const { validate } = require('../middleware/validation.middleware');
const c = require('../controllers/merchandisingPairing.controller');

router.use(protect, attachTenant, requireOwnTenant, requireCapability('merchandising_manual'));

// GET /api/merchandising/pairings — the tenant's rows, newest first
router.get('/', c.listPairings);

// PUT /api/merchandising/pairings — upsert on {tenant, sourceProduct}
router.put(
  '/',
  [
    body('sourceProduct').isMongoId().withMessage('Valid source product ID is required'),
    body('suggestedProducts')
      .isArray({ min: 1, max: 4 })
      .withMessage('Suggested products must be 1–4 unique product references'),
    body('suggestedProducts.*').isMongoId().withMessage('Invalid suggested product ID'),
    body('active').optional().isBoolean().withMessage('Active must be a boolean'),
  ],
  validate,
  c.upsertPairing
);

// DELETE /api/merchandising/pairings/:id
router.delete(
  '/:id',
  [param('id').isMongoId().withMessage('Valid pairing ID is required')],
  validate,
  c.deletePairing
);

module.exports = router;

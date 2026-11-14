// server/routes/adClick.routes.js
// PUBLIC merchandising-ads endpoints — mounted at /api/ads next to the
// tenant-dashboard campaign routes. Deliberately NO protect(): storefront
// visitors fire these; the click pipeline itself dedupes, gates on budget,
// and bills through the prepaid wallet (server/services/adClick.service.js).
const express = require('express');
const router = express.Router();
const { param, body } = require('express-validator');
const { validate } = require('../middleware/validation.middleware');
const c = require('../controllers/adClick.controller');

// POST /api/ads/clicks/:campaignId — dedupe + charge + redirect target.
// Body { visitorKey? } — falls back to a hash of the caller IP when absent.
router.post(
  '/clicks/:campaignId',
  [
    param('campaignId').isMongoId().withMessage('Valid campaign ID is required'),
    body('visitorKey').optional({ nullable: true }).isString()
      .withMessage('visitorKey must be a string'),
  ],
  validate,
  c.click
);

// POST /api/ads/impressions/:campaignId — fire-and-forget counter.
router.post(
  '/impressions/:campaignId',
  [param('campaignId').isMongoId().withMessage('Valid campaign ID is required')],
  validate,
  c.impression
);

module.exports = router;

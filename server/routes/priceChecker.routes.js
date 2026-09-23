const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect, attachTenant, tenantAdminOrSuperAdmin } = require('../middleware/auth.middleware');
const { assertWritesAllowed } = require('../middleware/tenant.middleware');
const { getTenantId } = require('../utils/tenantContext');
const { authenticatePriceChecker } = require('../middleware/priceChecker.middleware');
const c = require('../controllers/priceChecker.controller');
const router = express.Router();
const message = { success: false, message: 'Please wait a moment before trying again.' };
const ipLimit = rateLimit({
  windowMs: 60000,
  limit: 180,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message,
});
const sessionLimit = rateLimit({
  windowMs: 60000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message,
});
const kioskLimit = rateLimit({
  windowMs: 60000,
  limit: 120,
  keyGenerator: (req) => String(req.priceChecker.kiosk._id),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message,
});
router.use((req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
});
// Public read-only capability bootstrap. Its only write effect is rate limiting;
// the resulting audience-bound token grants no attendance or admin privileges.
router.post('/session', sessionLimit, c.session);
router.get('/config', ipLimit, authenticatePriceChecker, c.config);
router.post('/scan', ipLimit, authenticatePriceChecker, kioskLimit, c.scan);
router.use(protect, attachTenant, tenantAdminOrSuperAdmin);
router.use((req, res, next) => {
  getTenantId(req);
  assertWritesAllowed(req);
  next();
});
router.get('/options', c.options);
router.get('/analytics', c.analytics);
router.get('/kiosks', c.list);
router.post('/kiosks', c.create);
router.get('/kiosks/:id', c.get);
router.patch('/kiosks/:id', c.update);
router.delete('/kiosks/:id', c.remove);
module.exports = router;

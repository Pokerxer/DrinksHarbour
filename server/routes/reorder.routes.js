// routes/reorder.routes.js

const express = require('express');
const router = express.Router();
const reorderController = require('../controllers/reorder.controller');
const { protect, attachTenant, requireOwnTenant } = require('../middleware/auth.middleware');

// All routes require authentication and tenant context
router.use(protect);
router.use(attachTenant);
// Tenant-owned module: POS, sales, purchases and inventory data belongs to a
// single tenant. requireOwnTenant takes the tenant from the JWT claim only —
// no x-tenant-slug/?tenant= pivot, no client-supplied tenantId, no admin bypass.
router.use(requireOwnTenant);
// The purchases module is Growth and above on the pricing page, and
// purchaseOrder/purchaseAgreement have carried this gate since it was written —
// but the rest of the module did not, so a Starter tenant refused /purchases in
// the admin UI could still reach this router's API directly. A module gated at
// two of its seven doors is not gated.
router.use(require('../middleware/plan.middleware').requireCapability('purchase_orders'));

// Reorder rules CRUD
router.route('/rules')
  .get(reorderController.getRules)
  .post(reorderController.createRule);

router.route('/rules/:id')
  .get(reorderController.getRuleById)
  .patch(reorderController.updateRule)
  .delete(reorderController.deleteRule);

// Trigger a specific rule
router.post('/rules/:id/trigger', reorderController.triggerRule);

// Check all rules (manual trigger for all due rules)
router.post('/check', reorderController.checkRules);

// Get reorder suggestions based on current stock levels
router.get('/suggestions', reorderController.getReorderSuggestions);

module.exports = router;

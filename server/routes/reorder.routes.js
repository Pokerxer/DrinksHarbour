// routes/reorder.routes.js

const express = require('express');
const router = express.Router();
const reorderController = require('../controllers/reorder.controller');
const { protect, attachTenant } = require('../middleware/auth.middleware');

// All routes require authentication and tenant context
router.use(protect);
router.use(attachTenant);

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

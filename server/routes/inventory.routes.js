// routes/inventory.routes.js

const express = require('express');
const router = express.Router();
const {
  createMovement,
  getMovements,
  getInventorySummary,
  adjustInventory,
  recordReceived,
  recordReturn,
  cancelMovement,
  getLowStockItems,
  getInventoryValuation,
  getNextPONumber,
  transferStock,
} = require('../controllers/inventory.controller');
const { 
  protect, 
  attachTenant,
  tenantAdminOrSuperAdmin 
} = require('../middleware/auth.middleware');

// All routes require authentication and tenant context
router.use(protect);
router.use(attachTenant);

// Movement routes - use tenantAdminOrSuperAdmin which already handles super_admin
router.route('/movements')
  .post(tenantAdminOrSuperAdmin, createMovement)
  .get(tenantAdminOrSuperAdmin, getMovements);

router.post('/movements/:id/cancel', tenantAdminOrSuperAdmin, cancelMovement);

// Summary
router.get('/summary/:subProductId', tenantAdminOrSuperAdmin, getInventorySummary);

// Adjustments
router.post('/adjust', tenantAdminOrSuperAdmin, adjustInventory);
router.post('/received', tenantAdminOrSuperAdmin, recordReceived);
router.post('/return', tenantAdminOrSuperAdmin, recordReturn);
router.post('/transfer', tenantAdminOrSuperAdmin, transferStock);

// Utils
router.get('/next-po', tenantAdminOrSuperAdmin, getNextPONumber);

// Reports
router.get('/low-stock', tenantAdminOrSuperAdmin, getLowStockItems);
router.get('/valuation', tenantAdminOrSuperAdmin, getInventoryValuation);

module.exports = router;

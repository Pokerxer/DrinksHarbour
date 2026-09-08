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
  tenantAdminOrSuperAdmin,
  requireOwnTenant,
  authorizeTenantAction,
} = require('../middleware/auth.middleware');

// All routes require authentication and tenant context
router.use(protect);
router.use(attachTenant);
// Tenant-owned module: POS, sales, purchases and inventory data belongs to a
// single tenant. requireOwnTenant takes the tenant from the JWT claim only —
// no x-tenant-slug/?tenant= pivot, no client-supplied tenantId, no admin bypass.
router.use(requireOwnTenant);

const readInventory = authorizeTenantAction('inventory:read');
const writeInventory = authorizeTenantAction('inventory:write');
const adjustStock = authorizeTenantAction('inventory:adjust');
const movementAction = (req, res, next) => {
  if (['adjustment_in', 'adjustment_out'].includes(req.body?.type) || req.body?.category === 'adjustment') return adjustStock(req, res, next);
  next();
};

// Movement routes - use tenantAdminOrSuperAdmin which already handles super_admin
router.route('/movements')
  .post(writeInventory, movementAction, createMovement)
  .get(readInventory, getMovements);

router.post('/movements/:id/cancel', adjustStock, cancelMovement);

// Summary
router.get('/summary/:subProductId', readInventory, getInventorySummary);

// Adjustments
router.post('/adjust', adjustStock, adjustInventory);
router.post('/received', writeInventory, recordReceived);
router.post('/return', writeInventory, recordReturn);
router.post('/transfer', writeInventory, transferStock);

// Utils
router.get('/next-po', readInventory, getNextPONumber);

// Reports
router.get('/low-stock', readInventory, getLowStockItems);
router.get('/valuation', readInventory, getInventoryValuation);

module.exports = router;

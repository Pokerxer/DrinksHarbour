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
} = require('../controllers/inventory.controller');
const { protect, authorize, superAdminOnly, tenantAdminOrSuperAdmin } = require('../middleware/auth.middleware');
const { ForbiddenError } = require('../utils/errors');

// All routes require authentication
router.use(protect);

// Helper to allow super_admin or tenant roles
const allowSuperAdminOrTenant = (...roles) => (req, res, next) => {
  if (req.user?.role === 'super_admin') {
    return next();
  }
  if (!roles.includes(req.user?.role)) {
    return next(new ForbiddenError(`Access denied. Required roles: ${roles.join(', ')}`));
  }
  next();
};

// Movement routes - super_admin can access all
router.route('/movements')
  .post(allowSuperAdminOrTenant('tenant_admin', 'tenant_staff'), createMovement)
  .get(allowSuperAdminOrTenant('tenant_admin', 'tenant_staff', 'tenant_viewer'), getMovements);

router.post('/movements/:id/cancel', allowSuperAdminOrTenant('tenant_admin'), cancelMovement);

// Summary - super_admin can access
router.get('/summary/:subProductId', allowSuperAdminOrTenant('tenant_admin', 'tenant_staff', 'tenant_viewer'), getInventorySummary);

// Adjustments
router.post('/adjust', allowSuperAdminOrTenant('tenant_admin', 'tenant_staff'), adjustInventory);
router.post('/received', allowSuperAdminOrTenant('tenant_admin', 'tenant_staff'), recordReceived);
router.post('/return', allowSuperAdminOrTenant('tenant_admin', 'tenant_staff'), recordReturn);

// Reports
router.get('/low-stock', allowSuperAdminOrTenant('tenant_admin', 'tenant_staff', 'tenant_viewer'), getLowStockItems);
router.get('/valuation', allowSuperAdminOrTenant('tenant_admin', 'tenant_viewer'), getInventoryValuation);

module.exports = router;

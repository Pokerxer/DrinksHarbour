// routes/warehouse.routes.js
const express = require('express');
const router = express.Router();
const c = require('../controllers/warehouse.controller');
const { protect, attachTenant, tenantAdminOrSuperAdmin, requireOwnTenant } = require('../middleware/auth.middleware');

router.use(protect);
router.use(attachTenant);
// Tenant-owned module: POS, sales, purchases and inventory data belongs to a
// single tenant. requireOwnTenant takes the tenant from the JWT claim only —
// no x-tenant-slug/?tenant= pivot, no client-supplied tenantId, no admin bypass.
router.use(requireOwnTenant);

router.post('/transfer', tenantAdminOrSuperAdmin, c.transferStock);

// Aggregate stock across all warehouses (warehouse-analysis reporting).
// Registered before '/:id' so the literal 'stock' segment isn't read as an id.
router.get('/stock/all', tenantAdminOrSuperAdmin, c.getAllWarehouseStock);

// Tenant-level warehouse settings.
// Registered before '/:id' so the literal 'settings' segment isn't read as an id.
router.route('/settings')
  .get(tenantAdminOrSuperAdmin, c.getWarehouseSettings)
  .patch(tenantAdminOrSuperAdmin, c.updateWarehouseSettings);

router.route('/')
  .get(tenantAdminOrSuperAdmin, c.getWarehouses)
  .post(tenantAdminOrSuperAdmin, c.createWarehouse);

router.route('/:id')
  .get(tenantAdminOrSuperAdmin, c.getWarehouseById)
  .patch(tenantAdminOrSuperAdmin, c.updateWarehouse)
  .delete(tenantAdminOrSuperAdmin, c.deleteWarehouse);

router.get('/:id/stock', tenantAdminOrSuperAdmin, c.getWarehouseStock);
router.get('/:id/batches', tenantAdminOrSuperAdmin, c.getWarehouseBatches);
router.get('/:id/movements', tenantAdminOrSuperAdmin, c.getWarehouseMovements);
router.post('/:id/stock/adjust', tenantAdminOrSuperAdmin, c.adjustWarehouseStock);

module.exports = router;

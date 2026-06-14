// routes/warehouse.routes.js
const express = require('express');
const router = express.Router();
const c = require('../controllers/warehouse.controller');
const { protect, attachTenant, tenantAdminOrSuperAdmin } = require('../middleware/auth.middleware');

router.use(protect);
router.use(attachTenant);

router.post('/transfer', tenantAdminOrSuperAdmin, c.transferStock);

router.route('/')
  .get(tenantAdminOrSuperAdmin, c.getWarehouses)
  .post(tenantAdminOrSuperAdmin, c.createWarehouse);

router.route('/:id')
  .get(tenantAdminOrSuperAdmin, c.getWarehouseById)
  .patch(tenantAdminOrSuperAdmin, c.updateWarehouse)
  .delete(tenantAdminOrSuperAdmin, c.deleteWarehouse);

router.get('/:id/stock', tenantAdminOrSuperAdmin, c.getWarehouseStock);
router.post('/:id/stock/adjust', tenantAdminOrSuperAdmin, c.adjustWarehouseStock);

module.exports = router;

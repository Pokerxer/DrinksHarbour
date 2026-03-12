// routes/warehouse.routes.js

const express = require('express');
const router = express.Router();
const warehouseController = require('../controllers/warehouse.controller');
const { 
  protect, 
  attachTenant,
  tenantAdminOrSuperAdmin 
} = require('../middleware/auth.middleware');

// All routes require authentication and tenant context
router.use(protect);
router.use(attachTenant);

// Routes accessible by all tenant users and super_admin
router.get('/', 
  tenantAdminOrSuperAdmin,
  warehouseController.getWarehouses
);

router.get('/low-stock',
  tenantAdminOrSuperAdmin,
  warehouseController.getLowStockWarehouses
);

router.get('/capacity-utilization',
  tenantAdminOrSuperAdmin,
  warehouseController.getCapacityUtilization
);

router.get('/:id',
  tenantAdminOrSuperAdmin,
  warehouseController.getWarehouseById
);

router.get('/:id/inventory',
  tenantAdminOrSuperAdmin,
  warehouseController.getWarehouseInventory
);

// Routes that require admin access
router.post('/',
  tenantAdminOrSuperAdmin,
  warehouseController.createWarehouse
);

router.patch('/:id',
  tenantAdminOrSuperAdmin,
  warehouseController.updateWarehouse
);

router.delete('/:id',
  tenantAdminOrSuperAdmin,
  warehouseController.deleteWarehouse
);

router.post('/:id/adjust',
  tenantAdminOrSuperAdmin,
  warehouseController.adjustWarehouseStock
);

module.exports = router;

// routes/uomConversion.routes.js
const express = require('express');
const router = express.Router();
const {
  createUOMConversion,
  getUOMConversions,
  getUOMConversion,
  updateUOMConversion,
  deleteUOMConversion,
  convertUnits,
} = require('../controllers/uomConversion.controller');
const {
  protect,
  attachTenant,
  tenantAdminOrSuperAdmin,

  requireOwnTenant,
} = require('../middleware/auth.middleware');

router.use(protect);
router.use(attachTenant);
// Tenant-owned module: POS, sales, purchases and inventory data belongs to a
// single tenant. requireOwnTenant takes the tenant from the JWT claim only —
// no x-tenant-slug/?tenant= pivot, no client-supplied tenantId, no admin bypass.
router.use(requireOwnTenant);

router
  .route('/')
  .post(tenantAdminOrSuperAdmin, createUOMConversion)
  .get(tenantAdminOrSuperAdmin, getUOMConversions);

router
  .route('/:id')
  .get(tenantAdminOrSuperAdmin, getUOMConversion)
  .patch(tenantAdminOrSuperAdmin, updateUOMConversion)
  .delete(tenantAdminOrSuperAdmin, deleteUOMConversion);

router.get('/convert', tenantAdminOrSuperAdmin, convertUnits);

module.exports = router;

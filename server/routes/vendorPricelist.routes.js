// routes/vendorPricelist.routes.js
const express = require('express');
const router = express.Router();
const {
  createVendorPricelist,
  getVendorPricelist,
  getVendorPricelists,
  updateVendorPricelist,
  deleteVendorPricelist,
  getPricelistForProduct,
  getVendorPriceListsByProduct,
  syncNow,
  getPriceMatrix,
} = require('../controllers/vendorPricelist.controller');
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
  .post(tenantAdminOrSuperAdmin, createVendorPricelist)
  .get(tenantAdminOrSuperAdmin, getVendorPricelists);

router.get('/matrix', tenantAdminOrSuperAdmin, getPriceMatrix);

router
  .route('/:id')
  .get(tenantAdminOrSuperAdmin, getVendorPricelist)
  .patch(tenantAdminOrSuperAdmin, updateVendorPricelist)
  .delete(tenantAdminOrSuperAdmin, deleteVendorPricelist);

router.get('/product/price', tenantAdminOrSuperAdmin, getPricelistForProduct);
router.get('/product/vendor-prices', tenantAdminOrSuperAdmin, getVendorPriceListsByProduct);

router.post('/:id/sync-now', tenantAdminOrSuperAdmin, syncNow);

module.exports = router;

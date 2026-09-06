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
// The purchases module is Growth and above on the pricing page, and
// purchaseOrder/purchaseAgreement have carried this gate since it was written —
// but the rest of the module did not, so a Starter tenant refused /purchases in
// the admin UI could still reach this router's API directly. A module gated at
// two of its seven doors is not gated.
router.use(require('../middleware/plan.middleware').requireCapability('purchase_orders'));

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

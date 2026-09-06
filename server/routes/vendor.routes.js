// routes/vendor.routes.js
const express = require('express');
const router = express.Router();
const {
  createVendor,
  searchVendors,
  getVendor,
  getAllVendors,
  updateVendor,
  deleteVendor,
  uploadVendorPhoto,
} = require('../controllers/vendor.controller');
const { protect, attachTenant, tenantAdminOrSuperAdmin, requireOwnTenant } = require('../middleware/auth.middleware');
const { uploadAvatar } = require('../middleware/imageUpload.middleware');

// All routes require authentication and tenant context
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

// Search vendors
router.get('/search', tenantAdminOrSuperAdmin, searchVendors);

// Get all vendors
router.get('/', tenantAdminOrSuperAdmin, getAllVendors);

// CRUD routes
router.route('/:id')
  .get(tenantAdminOrSuperAdmin, getVendor)
  .put(tenantAdminOrSuperAdmin, updateVendor)
  .delete(tenantAdminOrSuperAdmin, deleteVendor);

// Create vendor (must be separate from :id to avoid conflict)
router.post('/', tenantAdminOrSuperAdmin, createVendor);

// Upload vendor photo
router.post('/:id/photo', tenantAdminOrSuperAdmin, uploadAvatar, uploadVendorPhoto);

module.exports = router;

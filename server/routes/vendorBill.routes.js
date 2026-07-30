// routes/vendorBill.routes.js
const express = require("express");
const router = express.Router();
const {
  createVendorBill,
  getVendorBill,
  getVendorBills,
  updateVendorBill,
  deleteVendorBill,
  recordPayment,
  validateBill,
} = require("../controllers/vendorBill.controller");
const {
  protect,
  attachTenant,
  tenantAdminOrSuperAdmin,

  requireOwnTenant,
} = require("../middleware/auth.middleware");

// All routes require authentication and tenant context
router.use(protect);
router.use(attachTenant);
// Tenant-owned module: POS, sales, purchases and inventory data belongs to a
// single tenant. requireOwnTenant takes the tenant from the JWT claim only —
// no x-tenant-slug/?tenant= pivot, no client-supplied tenantId, no admin bypass.
router.use(requireOwnTenant);

// CRUD routes
router
  .route("/")
  .post(tenantAdminOrSuperAdmin, createVendorBill)
  .get(tenantAdminOrSuperAdmin, getVendorBills);

router
  .route("/:id")
  .get(tenantAdminOrSuperAdmin, getVendorBill)
  .patch(tenantAdminOrSuperAdmin, updateVendorBill)
  .delete(tenantAdminOrSuperAdmin, deleteVendorBill);

// Payment recording
router.post("/:id/pay", tenantAdminOrSuperAdmin, recordPayment);

// 3-way matching validation
router.post("/:id/validate", tenantAdminOrSuperAdmin, validateBill);

module.exports = router;

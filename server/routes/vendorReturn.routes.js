const express = require("express");
const router = express.Router();
const {
  createVendorReturn,
  getVendorReturns,
  getVendorReturn,
  updateVendorReturn,
  updateReturnStatus,
  recordRefund,
  deleteVendorReturn,
  createReturnFromBill,
} = require("../controllers/vendorReturn.controller");
const { protect, attachTenant, tenantAdminOrSuperAdmin, requireOwnTenant } = require("../middleware/auth.middleware");

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

// CRUD routes
router.route("/").post(tenantAdminOrSuperAdmin, createVendorReturn).get(getVendorReturns);
router.route("/:id").get(getVendorReturn).patch(tenantAdminOrSuperAdmin, updateVendorReturn).delete(tenantAdminOrSuperAdmin, deleteVendorReturn);

// Create return from bill
router.post("/from-bill", tenantAdminOrSuperAdmin, createReturnFromBill);

// Status update
router.patch("/:id/status", tenantAdminOrSuperAdmin, updateReturnStatus);

// Refund
router.post("/:id/refund", tenantAdminOrSuperAdmin, recordRefund);

module.exports = router;

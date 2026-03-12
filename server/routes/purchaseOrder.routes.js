// routes/purchaseOrder.routes.js
const express = require("express");
const router = express.Router();
const {
  createPurchaseOrder,
  getPurchaseOrder,
  getPurchaseOrders,
  updatePurchaseOrderStatus,
  deletePurchaseOrder,
  generatePurchaseOrderReceipt,
  approvePO,
  rejectPO,
  lockPO,
  unlockPO,
  createBillFromPO,
  sendPOToVendor,
  // Analytics
  getPurchaseAnalyticsSummary,
  getPurchaseAnalyticsByVendor,
} = require("../controllers/purchaseOrder.controller");
const {
  protect,
  attachTenant,
  tenantAdminOrSuperAdmin,
} = require("../middleware/auth.middleware");

// All routes require authentication and tenant context
router.use(protect);
router.use(attachTenant);

// CRUD routes
router
  .route("/")
  .post(tenantAdminOrSuperAdmin, createPurchaseOrder)
  .get(tenantAdminOrSuperAdmin, getPurchaseOrders);

router
  .route("/:id")
  .get(tenantAdminOrSuperAdmin, getPurchaseOrder)
  .delete(tenantAdminOrSuperAdmin, deletePurchaseOrder);

// Status update
router.patch("/:id/status", tenantAdminOrSuperAdmin, updatePurchaseOrderStatus);

// Receipt generation
router.get(
  "/:id/receipt",
  tenantAdminOrSuperAdmin,
  generatePurchaseOrderReceipt,
);

// Approval workflow
router.post("/:id/approve", tenantAdminOrSuperAdmin, approvePO);
router.post("/:id/reject", tenantAdminOrSuperAdmin, rejectPO);

// Lock/Unlock PO
router.post("/:id/lock", tenantAdminOrSuperAdmin, lockPO);
router.post("/:id/unlock", tenantAdminOrSuperAdmin, unlockPO);

// Create Bill from PO
router.post("/:id/create-bill", tenantAdminOrSuperAdmin, createBillFromPO);

// Send PO to Vendor
router.post("/:id/send-to-vendor", tenantAdminOrSuperAdmin, sendPOToVendor);

// Analytics routes
router.get("/analytics/summary", tenantAdminOrSuperAdmin, getPurchaseAnalyticsSummary);
router.get("/analytics/by-vendor", tenantAdminOrSuperAdmin, getPurchaseAnalyticsByVendor);

module.exports = router;

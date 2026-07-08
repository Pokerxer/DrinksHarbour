// routes/purchaseOrder.routes.js
const express = require("express");
const router = express.Router();
const {
  createPurchaseOrder,
  getPurchaseOrder,
  getPurchaseOrders,
  updatePurchaseOrder,
  updatePurchaseOrderStatus,
  receivePurchaseOrder,
  deletePurchaseOrder,
  generatePurchaseOrderReceipt,
  approvePO,
  rejectPO,
  lockPO,
  unlockPO,
  createBillFromPO,
  sendPOToVendor,
  returnPurchaseOrder,
  getPurchaseSettings,
  updatePurchaseSettings,
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

// Analytics routes MUST be before /:id to avoid Express treating "analytics" as an id param
router.get("/analytics/summary", tenantAdminOrSuperAdmin, getPurchaseAnalyticsSummary);
router.get("/analytics/by-vendor", tenantAdminOrSuperAdmin, getPurchaseAnalyticsByVendor);

// Tenant purchase settings — also before /:id ("settings" is not an id)
router.get("/settings", tenantAdminOrSuperAdmin, getPurchaseSettings);
router.patch("/settings", tenantAdminOrSuperAdmin, updatePurchaseSettings);

// CRUD routes
router
  .route("/")
  .post(tenantAdminOrSuperAdmin, createPurchaseOrder)
  .get(tenantAdminOrSuperAdmin, getPurchaseOrders);

router
  .route("/:id")
  .get(tenantAdminOrSuperAdmin, getPurchaseOrder)
  .patch(tenantAdminOrSuperAdmin, updatePurchaseOrder)
  .delete(tenantAdminOrSuperAdmin, deletePurchaseOrder);

// Status update
router.patch("/:id/status", tenantAdminOrSuperAdmin, updatePurchaseOrderStatus);

// Record a (partial) receipt — accumulates received qty; posting happens at validate
router.post("/:id/receive", tenantAdminOrSuperAdmin, receivePurchaseOrder);

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

// Return items to vendor
router.post("/:id/return", tenantAdminOrSuperAdmin, returnPurchaseOrder);

module.exports = router;

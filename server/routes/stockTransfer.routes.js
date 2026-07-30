// routes/stockTransfer.routes.js
const express = require("express");
const router = express.Router();
const {
  createStockTransfer,
  getStockTransfers,
  getStockTransfer,
  updateStockTransfer,
  deleteStockTransfer,
  updateStockTransferStatus,
  approveStockTransfer,
  rejectStockTransfer,
} = require("../controllers/stockTransfer.controller");
const {
  protect,
  attachTenant,
  tenantAdminOrSuperAdmin,

  requireOwnTenant,
} = require("../middleware/auth.middleware");

router.use(protect);
router.use(attachTenant);
// Tenant-owned module: POS, sales, purchases and inventory data belongs to a
// single tenant. requireOwnTenant takes the tenant from the JWT claim only —
// no x-tenant-slug/?tenant= pivot, no client-supplied tenantId, no admin bypass.
router.use(requireOwnTenant);

router
  .route("/")
  .post(tenantAdminOrSuperAdmin, createStockTransfer)
  .get(tenantAdminOrSuperAdmin, getStockTransfers);

router
  .route("/:id")
  .get(tenantAdminOrSuperAdmin, getStockTransfer)
  .patch(tenantAdminOrSuperAdmin, updateStockTransfer)
  .delete(tenantAdminOrSuperAdmin, deleteStockTransfer);

router.patch("/:id/status", tenantAdminOrSuperAdmin, updateStockTransferStatus);
router.patch("/:id/approve", tenantAdminOrSuperAdmin, approveStockTransfer);
router.patch("/:id/reject", tenantAdminOrSuperAdmin, rejectStockTransfer);

module.exports = router;

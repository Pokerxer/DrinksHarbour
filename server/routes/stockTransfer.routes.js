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
} = require("../middleware/auth.middleware");

router.use(protect);
router.use(attachTenant);

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

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
} = require("../middleware/auth.middleware");

// All routes require authentication and tenant context
router.use(protect);
router.use(attachTenant);

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

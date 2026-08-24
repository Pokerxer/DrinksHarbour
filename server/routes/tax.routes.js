// routes/tax.routes.js
const express = require('express');
const router = express.Router();
const {
  createTax,
  getTaxes,
  updateTax,
  deleteTax,
  getTaxRecords,
  getTaxSummary,
} = require('../controllers/tax.controller');
const {
  protect,
  attachTenant,
  tenantAdminOrSuperAdmin,
  requireOwnTenant,
} = require('../middleware/auth.middleware');

router.use(protect);
router.use(attachTenant);
// Tenant-owned accounting data: JWT tenant only, no admin pivot.
router.use(requireOwnTenant);

router.route('/')
  .post(tenantAdminOrSuperAdmin, createTax)
  .get(tenantAdminOrSuperAdmin, getTaxes);

// Static segments before :id
router.get('/records', tenantAdminOrSuperAdmin, getTaxRecords);
router.get('/summary', tenantAdminOrSuperAdmin, getTaxSummary);

router.route('/:id')
  .patch(tenantAdminOrSuperAdmin, updateTax)
  .delete(tenantAdminOrSuperAdmin, deleteTax);

module.exports = router;

// routes/purchaseAgreement.routes.js
const express = require('express');
const router = express.Router();
const {
  createPurchaseAgreement,
  getPurchaseAgreement,
  getPurchaseAgreements,
  updatePurchaseAgreement,
  deletePurchaseAgreement,
  activatePurchaseAgreement,
  cancelPurchaseAgreement,
  addTenderResponse,
  selectTenderWinner,
  createPOFromAgreement,
} = require('../controllers/purchaseAgreement.controller');
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

router
  .route('/')
  .post(tenantAdminOrSuperAdmin, createPurchaseAgreement)
  .get(tenantAdminOrSuperAdmin, getPurchaseAgreements);

router
  .route('/:id')
  .get(tenantAdminOrSuperAdmin, getPurchaseAgreement)
  .patch(tenantAdminOrSuperAdmin, updatePurchaseAgreement)
  .delete(tenantAdminOrSuperAdmin, deletePurchaseAgreement);

router.post('/:id/activate', tenantAdminOrSuperAdmin, activatePurchaseAgreement);
router.post('/:id/cancel', tenantAdminOrSuperAdmin, cancelPurchaseAgreement);
router.post('/:id/tender-response', tenantAdminOrSuperAdmin, addTenderResponse);
router.post('/:id/select-winner', tenantAdminOrSuperAdmin, selectTenderWinner);
router.post('/:id/create-po', tenantAdminOrSuperAdmin, createPOFromAgreement);

module.exports = router;

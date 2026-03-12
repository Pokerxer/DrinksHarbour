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
  addTenderResponse,
  selectTenderWinner,
  createPOFromAgreement,
} = require('../controllers/purchaseAgreement.controller');
const {
  protect,
  attachTenant,
  tenantAdminOrSuperAdmin,
} = require('../middleware/auth.middleware');

router.use(protect);
router.use(attachTenant);

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
router.post('/:id/tender-response', tenantAdminOrSuperAdmin, addTenderResponse);
router.post('/:id/select-winner', tenantAdminOrSuperAdmin, selectTenderWinner);
router.post('/:id/create-po', tenantAdminOrSuperAdmin, createPOFromAgreement);

module.exports = router;

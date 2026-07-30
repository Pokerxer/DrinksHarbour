// routes/exchangeRate.routes.js
const express = require('express');
const router = express.Router();
const {
  createExchangeRate,
  getExchangeRates,
  getLatestRates,
  convertCurrency,
  updateExchangeRate,
  deleteExchangeRate,
  syncLiveRates,
} = require('../controllers/exchangeRate.controller');
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
  .post(tenantAdminOrSuperAdmin, createExchangeRate)
  .get(tenantAdminOrSuperAdmin, getExchangeRates);

router.get('/latest', tenantAdminOrSuperAdmin, getLatestRates);
router.post('/sync', tenantAdminOrSuperAdmin, syncLiveRates);
router.get('/convert', tenantAdminOrSuperAdmin, convertCurrency);

router
  .route('/:id')
  .patch(tenantAdminOrSuperAdmin, updateExchangeRate)
  .delete(tenantAdminOrSuperAdmin, deleteExchangeRate);

module.exports = router;

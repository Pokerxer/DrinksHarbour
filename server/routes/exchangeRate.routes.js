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
} = require('../controllers/exchangeRate.controller');
const {
  protect,
  attachTenant,
  tenantAdminOrSuperAdmin,
} = require('../middleware/auth.middleware');

router.use(protect);
router.use(attachTenant);

router
  .route('/')
  .post(tenantAdminOrSuperAdmin, createExchangeRate)
  .get(tenantAdminOrSuperAdmin, getExchangeRates);

router.get('/latest', tenantAdminOrSuperAdmin, getLatestRates);
router.get('/convert', tenantAdminOrSuperAdmin, convertCurrency);

router
  .route('/:id')
  .patch(tenantAdminOrSuperAdmin, updateExchangeRate)
  .delete(tenantAdminOrSuperAdmin, deleteExchangeRate);

module.exports = router;

// routes/uomConversion.routes.js
const express = require('express');
const router = express.Router();
const {
  createUOMConversion,
  getUOMConversions,
  getUOMConversion,
  updateUOMConversion,
  deleteUOMConversion,
  convertUnits,
} = require('../controllers/uomConversion.controller');
const {
  protect,
  attachTenant,
  tenantAdminOrSuperAdmin,
} = require('../middleware/auth.middleware');

router.use(protect);
router.use(attachTenant);

router
  .route('/')
  .post(tenantAdminOrSuperAdmin, createUOMConversion)
  .get(tenantAdminOrSuperAdmin, getUOMConversions);

router
  .route('/:id')
  .get(tenantAdminOrSuperAdmin, getUOMConversion)
  .patch(tenantAdminOrSuperAdmin, updateUOMConversion)
  .delete(tenantAdminOrSuperAdmin, deleteUOMConversion);

router.get('/convert', tenantAdminOrSuperAdmin, convertUnits);

module.exports = router;

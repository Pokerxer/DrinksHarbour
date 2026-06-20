// routes/employee.routes.js
const express = require('express');
const router = express.Router();
const c = require('../controllers/employee.controller');
const { protect, attachTenant, tenantAdminOrSuperAdmin } = require('../middleware/auth.middleware');

router.use(protect);
router.use(attachTenant);

router.route('/')
  .get(tenantAdminOrSuperAdmin, c.listEmployees)
  .post(tenantAdminOrSuperAdmin, c.createEmployee);

router.route('/:id')
  .patch(tenantAdminOrSuperAdmin, c.updateEmployee)
  .delete(tenantAdminOrSuperAdmin, c.deleteEmployee);

router.route('/:id/pin')
  .post(tenantAdminOrSuperAdmin, c.setEmployeePin)
  .delete(tenantAdminOrSuperAdmin, c.clearEmployeePin);

module.exports = router;

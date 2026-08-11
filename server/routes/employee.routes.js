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
  .get(tenantAdminOrSuperAdmin, c.getEmployee)
  .patch(tenantAdminOrSuperAdmin, c.updateEmployee)
  .delete(tenantAdminOrSuperAdmin, c.deleteEmployee);

// A POST, not a PATCH: the server draws the number, the client never names it.
router.route('/:id/badge-number')
  .post(tenantAdminOrSuperAdmin, c.issueBadgeNumber);

router.route('/:id/pin')
  .post(tenantAdminOrSuperAdmin, c.setEmployeePin)
  .delete(tenantAdminOrSuperAdmin, c.clearEmployeePin);

module.exports = router;

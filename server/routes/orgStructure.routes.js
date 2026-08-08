// server/routes/orgStructure.routes.js
//
// Departments, job positions and HR/planning employee roles. Three routers over
// one controller (the multi-router pattern from appraisal.routes.js), so each
// gets its own mount path in server.js while sharing identical guards.
//
// Every router is admin-gated AND tenant-locked: requireOwnTenant stops a
// super_admin carrying a tenant claim from mutating another tenant's structure,
// and tenantAdminOrSuperAdmin keeps ordinary staff out entirely.
const express = require('express');
const {
  protect,
  attachTenant,
  requireOwnTenant,
  tenantAdminOrSuperAdmin,
} = require('../middleware/auth.middleware');

const c = require('../controllers/orgStructure.controller');

const departmentRouter = express.Router();
const jobPositionRouter = express.Router();
const employeeRoleRouter = express.Router();

for (const r of [departmentRouter, jobPositionRouter, employeeRoleRouter]) {
  r.use(protect);
  r.use(attachTenant);
  r.use(requireOwnTenant);
  r.use(tenantAdminOrSuperAdmin);
}

// One shape for all three — the handlers differ, the surface does not.
for (const [router, handlers] of [
  [departmentRouter, c.departments],
  [jobPositionRouter, c.jobPositions],
  [employeeRoleRouter, c.employeeRoles],
]) {
  router.route('/').get(handlers.list).post(handlers.create);
  router.route('/:id').get(handlers.getOne).patch(handlers.update).delete(handlers.remove);
}

module.exports = { departmentRouter, jobPositionRouter, employeeRoleRouter };

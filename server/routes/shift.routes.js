// server/routes/shift.routes.js
//
// Shift templates and the roster. Two routers over one controller (the
// multi-router pattern from orgStructure.routes.js / appraisal.routes.js), so
// each gets its own mount path in server.js while sharing identical guards.
//
// Both are admin-gated AND tenant-locked: requireOwnTenant stops a super_admin
// carrying a tenant claim from rostering another tenant's staff, and
// tenantAdminOrSuperAdmin keeps ordinary staff out entirely — a draft roster is
// not visible to the people on it until it is published.
const express = require('express');
const {
  protect,
  attachTenant,
  requireOwnTenant,
  tenantAdminOrSuperAdmin,
} = require('../middleware/auth.middleware');

const c = require('../controllers/shift.controller');

const shiftTemplateRouter = express.Router();
const shiftRouter = express.Router();

for (const r of [shiftTemplateRouter, shiftRouter]) {
  r.use(protect);
  r.use(attachTenant);
  r.use(requireOwnTenant);
  r.use(tenantAdminOrSuperAdmin);
}

shiftTemplateRouter.route('/').get(c.templates.list).post(c.templates.create);
shiftTemplateRouter
  .route('/:id')
  .get(c.templates.getOne)
  .patch(c.templates.update)
  .delete(c.templates.remove);

// Declared before '/:id' so 'generate' and 'publish' are never read as ids.
shiftRouter.post('/generate', c.shifts.generate);
shiftRouter.post('/publish', c.shifts.publish);
shiftRouter.route('/').get(c.shifts.list).post(c.shifts.create);
shiftRouter.route('/:id').patch(c.shifts.update).delete(c.shifts.remove);

module.exports = { shiftTemplateRouter, shiftRouter };

// routes/role.routes.js
//
// Custom access-control roles. Mounted at /api/roles (server.js, beside
// /api/users and /api/employees).
//
// Guard chain, per route class:
//   protect → attachTenant → audience gate (dashboard roles only)
//   Mutations additionally run requireMfa — a no-op unless the caller is an
//   MFA-enabled privileged role, mirroring user.routes.js's admin section.
const express = require('express');
const router = express.Router();
const c = require('../controllers/role.controller');
const { protect, attachTenant } = require('../middleware/auth.middleware');
const { requireMfa } = require('../middleware/mfa.middleware');

router.use(protect);
router.use(attachTenant);

// The catalog backs the create/edit checkbox grid; any dashboard role may read it.
router.get('/permissions/catalog', c.requireDashboardAccess, c.getCatalog);

router.route('/')
  .get(c.requireDashboardAccess, c.listRoles)
  .post(c.requireDashboardAccess, requireMfa, c.createRole);

router.route('/:id')
  .put(c.requireDashboardAccess, requireMfa, c.updateRole)
  .delete(c.requireDashboardAccess, requireMfa, c.deleteRole);

module.exports = router;

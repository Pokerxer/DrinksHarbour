// server/routes/timeOff.routes.js
//
// Time-off requests and shift swaps. Two routers over one controller (the
// multi-router pattern from shift.routes.js / orgStructure.routes.js), so each
// gets its own mount path in server.js while sharing identical base guards.
//
// WHY THIS ROUTER DIFFERS FROM shift.routes.js
// --------------------------------------------
// Every earlier phase of this module puts `tenantAdminOrSuperAdmin` on the
// router with `router.use(...)`, because a roster, a template and a timesheet
// are all things only a manager touches. These are not. An ordinary
// `tenant_staff` employee is the person who RAISES a time-off request and
// answers a swap offered to them, so an admin gate on the router would lock the
// module's own users out of it.
//
// So the gate is split per-route:
//
//   base (every route)     protect → attachTenant → requireOwnTenant
//                          — signed in, and acting inside their own tenant.
//   staff-reachable        GET /, POST /, PATCH /:id/cancel,
//                          PATCH /:id/respond (swaps)
//   admin-only             PATCH /:id/decision  ← the approve/reject lane
//
// Reads are SCOPED rather than refused: the controller narrows a staff
// caller's list to their own rows instead of 403'ing them off the endpoint.
// Writes are checked against the row's owner inside the controller, because
// "is this yours" needs the document and middleware does not have it.
//
// Note that `requireOwnTenant` is still on every route. It is role-agnostic —
// it only asserts the caller's JWT tenant claim matches the resolved tenant —
// so it keeps a super_admin carrying somebody else's tenant claim out without
// keeping staff out.
const express = require('express');

const {
  protect,
  attachTenant,
  requireOwnTenant,
  tenantAdminOrSuperAdmin,
} = require('../middleware/auth.middleware');

const c = require('../controllers/timeOff.controller');

const timeOffRouter = express.Router();
const shiftSwapRouter = express.Router();

for (const r of [timeOffRouter, shiftSwapRouter]) {
  r.use(protect);
  r.use(attachTenant);
  r.use(requireOwnTenant);
}

timeOffRouter.route('/').get(c.timeOff.list).post(c.timeOff.create);
// Admin-only: deciding somebody else's leave is the whole point of the gate.
timeOffRouter.patch('/:id/decision', tenantAdminOrSuperAdmin, c.timeOff.decide);
// Not admin-only: withdrawing your own request is yours to do. Ownership is
// checked in the controller against the loaded row.
timeOffRouter.patch('/:id/cancel', c.timeOff.cancel);

// Declared before any other GET so 'my-shifts' is never read as an id. Staff-
// reachable on purpose: /api/shifts is admin-only, and somebody cannot offer a
// shift they are not allowed to see. This returns only the caller's own.
shiftSwapRouter.get('/my-shifts', c.swaps.myShifts);
shiftSwapRouter.route('/').get(c.swaps.list).post(c.swaps.create);
// The target answering. Deliberately staff-reachable, and deliberately NOT the
// thing that moves the shift — only /decision does that.
shiftSwapRouter.patch('/:id/respond', c.swaps.respond);
shiftSwapRouter.patch('/:id/decision', tenantAdminOrSuperAdmin, c.swaps.decide);
shiftSwapRouter.patch('/:id/cancel', c.swaps.cancel);

module.exports = { timeOffRouter, shiftSwapRouter };

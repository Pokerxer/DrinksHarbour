// Boots a throwaway Express app around a single router so route guards can be
// exercised over real HTTP without a database and without server.js's full
// bootstrap. Used by brandRouteAuth, taxonomyWriteRoles and brandPendingStatus.
//
// `protect` verifies a JWT and then loads the user with
//   User.findById(id).select(...).lean()
// so authenticating as a role means (a) signing a token with the same secret
// and (b) mocking that one query chain. Nothing else touches Mongo.

'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../../models/User');
const Tenant = require('../../models/Tenant');

// No test here connects to Mongo. If a request slips past a guard and reaches a
// controller, the model call would otherwise sit in Mongoose's 10s buffering
// window before failing — turning one bad assertion into a two-minute hang.
// Fail fast instead, so "reached the controller" shows up immediately.
mongoose.set('bufferTimeoutMS', 200);

const TENANT_ID = new mongoose.Types.ObjectId();

/** One canonical active user per role, reused across the auth test files. */
const ROLE_USERS = {
  super_admin:  { _id: new mongoose.Types.ObjectId(), email: 'sa@test.local', role: 'super_admin',  tenant: TENANT_ID, status: 'active' },
  admin:        { _id: new mongoose.Types.ObjectId(), email: 'ad@test.local', role: 'admin',        tenant: TENANT_ID, status: 'active' },
  tenant_owner: { _id: new mongoose.Types.ObjectId(), email: 'to@test.local', role: 'tenant_owner', tenant: TENANT_ID, status: 'active' },
  tenant_admin: { _id: new mongoose.Types.ObjectId(), email: 'ta@test.local', role: 'tenant_admin', tenant: TENANT_ID, status: 'active' },
  tenant_staff: { _id: new mongoose.Types.ObjectId(), email: 'ts@test.local', role: 'tenant_staff', tenant: TENANT_ID, status: 'active' },
  customer:     { _id: new mongoose.Types.ObjectId(), email: 'cu@test.local', role: 'customer',     tenant: null,      status: 'active' },
};

/** Signs the payload shape services/user.service.js issues at login. */
function signToken(user) {
  return jwt.sign(
    {
      userId: String(user._id),
      email: user.email,
      role: user.role,
      tenant: user.tenant ? String(user.tenant) : null,
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

/**
 * Makes `protect` resolve every token to `user`. Returns an Authorization
 * header value for that user. Scoped to the test `t` — node:test restores the
 * original method when the test ends.
 */
function mockAuthUser(t, user) {
  t.mock.method(User, 'findById', () => ({
    select: () => ({ lean: async () => ({ ...user }) }),
  }));
  return `Bearer ${signToken(user)}`;
}

/**
 * Makes `attachTenant` (= resolveTenantContext) resolve the caller's JWT tenant
 * to an approved, active tenant whose `_id` is TENANT_ID — the tenant every
 * ROLE_USERS entry belongs to.
 *
 * Routers that mount `attachTenant` need this: tenantAdminOrSuperAdmin refuses a
 * tenant_owner/tenant_admin with no `req.tenant`, so without it those roles 403
 * for a reason that has nothing to do with the guard under test.
 */
function mockTenantContext(t) {
  t.mock.method(Tenant, 'findById', () => ({
    select: () => ({
      lean: async () => ({
        _id: TENANT_ID,
        name: 'Test Tenant',
        slug: 'test-tenant',
        status: 'approved',
        subscriptionStatus: 'active',
        plan: 'enterprise',
      }),
    }),
  }));
}

/**
 * Mounts `router` at `basePath` behind a minimal error handler that mirrors
 * server.js's `err.statusCode || 500` mapping, and listens on an ephemeral
 * port. Always `await close()` in a finally block.
 */
async function startRouter(router, basePath = '/') {
  const app = express();
  app.use(express.json());
  app.use(basePath, router);
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    res.status(err.statusCode || err.status || 500).json({ message: err.message });
  });

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();

  return {
    url: (p) => `http://127.0.0.1:${port}${p}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

module.exports = {
  startRouter,
  mockAuthUser,
  mockTenantContext,
  signToken,
  ROLE_USERS,
  TENANT_ID,
};

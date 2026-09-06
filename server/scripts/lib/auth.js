// scripts/lib/auth.js
//
// Register/login helpers.
//
// server response envelope (utils/response.js):
//   { success, message, data }
// The auth service returns { user, token, refreshToken, ... } inside `data`,
// so tokens are at response.data.token.
//
// CAVEAT: the /register endpoint is rate-limited to 5 requests per IP per HOUR
// (server/routes/user.routes.js:29). Running the seeder with --customers > 5 in
// a single run WILL 429. Two escape hatches:
//   1. bulkCreateCustomersAsAdmin() — creates accounts via POST /api/users as a
//      super_admin. That route bypasses registerLimiter entirely (it sits on the
//      public /register route; the admin route is protected by protect() +
//      authorize + requireMfa, which a seed admin with mfaEnabled=false passes).
//      Admin-created users get isEmailVerified=true + status=active, which suits
//      seeding. This is the primary path for directory-driven runs.
//   2. registerCustomer() remains for small runs / manual testing.

const { ApiError } = require('./api-client');

/**
 * Bulk-create customer accounts through the admin endpoint, bypassing the
 * public register rate limit.
 *
 * POST /api/users — protected by router.use(protect) then
 *   router.use(authorize('admin', 'super_admin')) then router.use(requireMfa)
 * (routes/user.routes.js:315,447,448). The service (user.service.js
 * createUserAsAdmin) takes `role` and validates it is assignable by the actor;
 * a super_admin may create `customer`. These users are born isEmailVerified,
 * status active, and must then LOG IN (login limiter is far more generous:
 * 20/15min per IP).
 *
 * @param {ApiClient} adminApi  authenticated super_admin client
 * @param {Array<object>} customers  [{ email, password, firstName, lastName, phoneNumber, dateOfBirth }]
 * @returns {Promise<Array<{ email: string, ok: boolean, alreadyExists?: boolean, error?: string }>>}
 */
async function bulkCreateCustomersAsAdmin(adminApi, customers) {
  const results = [];
  for (const c of customers) {
    try {
      const res = await adminApi.post('/api/users', {
        email: c.email,
        password: c.password,
        firstName: c.firstName,
        lastName: c.lastName,
        phoneNumber: c.phoneNumber,
        dateOfBirth: c.dateOfBirth,
        role: 'customer',
      });
      if (!res?.data?.user?._id) {
        results.push({ email: c.email, ok: false, error: `response missing user._id — keys: ${Object.keys(res?.data || {}).join(',')}` });
        continue;
      }
      results.push({ email: c.email, ok: true, userId: res.data.user._id });
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && /exists|already/i.test(err.message)) {
        results.push({ email: c.email, ok: true, alreadyExists: true });
      } else {
        results.push({ email: c.email, ok: false, error: err.message });
      }
    }
  }
  return results;
}

/**
 * @param {ApiClient} api
 * @param {object} customer  from fake-data.generateCustomer()
 * @returns {Promise<{ token: string, user: object, alreadyExists: boolean }>}
 */
async function registerCustomer(api, customer) {
  const body = {
    email: customer.email,
    password: customer.password,
    firstName: customer.firstName,
    lastName: customer.lastName,
    phoneNumber: customer.phoneNumber,
  };

  try {
    const res = await api.post('/api/users/register', body);
    const token = res?.data?.token;
    if (!token) {
      throw new Error(
        `Register succeeded but response is missing data.token — got keys: ${Object.keys(res?.data || {}).join(',')}`,
      );
    }
    return { token, user: res.data.user, alreadyExists: false };
  } catch (err) {
    if (err instanceof ApiError && err.status === 400 && /exists|already/i.test(err.message)) {
      // Idempotent path: fall back to login with the seeded password.
      const login = await loginCustomer(api, customer.email, customer.password);
      return { ...login, alreadyExists: true };
    }
    throw err;
  }
}

/**
 * @returns {Promise<{ token: string, user: object }>}
 */
async function loginCustomer(api, email, password) {
  const res = await api.post('/api/users/login', { email, password });

  // MFA path: seed customers must never have MFA. If the server returns a
  // pendingMfaToken, we cannot proceed for that account — fail loudly rather
  // than corrupting the run with a token-less "success".
  if (res?.data?.pendingMfaToken) {
    throw new Error(
      `Login for ${email} returned a pending-MFA challenge; seeded customers must not have MFA enabled.`,
    );
  }

  const token = res?.data?.token;
  if (!token) {
    throw new Error(
      `Login for ${email} returned no token — response keys: ${Object.keys(res?.data || {}).join(',')}`,
    );
  }
  return { token, user: res.data.user };
}

/**
 * Generate a valid access token directly against the DB, bypassing the HTTP
 * login route and its rate limiter entirely.
 *
 * Why: the login endpoint is rate-limited to 20/15min per IP. For 200 seeded
 * customers that would stall the run for >90 minutes. The seeder already holds
 * a Mongoose connection to the target database (used for backdating), so the
 * token is generated using the same jwt.sign() call as the real login flow.
 *
 * @param {import('mongoose').Connection} conn   the seed DB connection
 * @param {string} email
 * @returns {Promise<{ token: string, user: object }>}
 */
async function issueTokenFromDb(conn, email) {
  const jwt = require('jsonwebtoken');
  const crypto = require('crypto');
  const db = conn.db;
  const user = await db.collection('users').findOne(
    { email: email.toLowerCase() },
    { projection: { _id: 1, email: 1, role: 1, tenant: 1, status: 1, firstName: 1, lastName: 1 } },
  );
  if (!user) throw new Error(`issueTokenFromDb: user "${email}" not found in seed DB`);
  if (user.status !== 'active') throw new Error(`issueTokenFromDb: user "${email}" status is "${user.status}"`);
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET not set');
  const payload = {
    userId: user._id,
    email: user.email,
    role: user.role,
    tenant: user.tenant || undefined,
    jti: crypto.randomUUID(),
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
  return { token, user };
}

/**
 * Log in an admin (super_admin or admin) using the same /login route.
 * The order-status transition endpoint requires this token.
 */
async function loginAdmin(api, email, password) {
  const { token, user } = await loginCustomer(api, email, password);
  const role = user?.role;
  if (!['super_admin', 'admin', 'tenant_owner', 'tenant_admin'].includes(role)) {
    throw new Error(
      `Account ${email} has role "${role}" — cannot advance orders to delivered. ` +
      'Need super_admin, admin, tenant_owner or tenant_admin.',
    );
  }
  return { token, user };
}

module.exports = { registerCustomer, loginCustomer, loginAdmin, bulkCreateCustomersAsAdmin, issueTokenFromDb };

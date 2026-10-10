'use strict';
const crypto = require('crypto');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const tokens = require('./tenantCustomer.tokens');
const { customerIdentity } = require('../utils/customerIdentity');
const { UnauthorizedError } = require('../utils/errors');
function profile(user) {
  return {
    _id: String(user._id),
    tenantId: String(user.tenant),
    role: 'customer',
    firstName: user.firstName,
    lastName: user.lastName || '',
    email: user.email,
    phone: user.phone || '',
    isEmailVerified: !!user.isEmailVerified,
  };
}
async function activeUser(tenant, decoded) {
  const user = await User.findOne({
    _id: decoded.userId,
    ...customerIdentity(tenant),
    status: 'active',
  });
  if (
    !user ||
    (user.passwordChangedAt &&
      (decoded.pwdAt || 0) !== user.passwordChangedAt.getTime())
  )
    throw new UnauthorizedError('Please sign in to this store again');
  return user;
}
async function issue(tenant, user) {
  const jti = crypto.randomUUID();
  const refreshToken = tokens.sign(
    tenant,
    user._id,
    'refresh',
    jti,
    '30d',
    user.passwordChangedAt?.getTime() || 0,
  );
  await RefreshToken.store({
    jti,
    tokenHash: tokens.hash(refreshToken),
    userId: user._id,
    tenantId: tenant._id,
    expiresAt: new Date(Date.now() + 30 * 86400000),
  });
  return {
    token: tokens.sign(
      tenant,
      user._id,
      'access',
      jti,
      '15m',
      user.passwordChangedAt?.getTime() || 0,
    ),
    refreshToken,
    user: profile(user),
  };
}
async function me(tenant, token) {
  const data = tokens.verify(tenant, token, 'access');
  const user = await activeUser(tenant, data);
  const session = await RefreshToken.exists({
    jti: data.jti,
    user: user._id,
    tenant: tenant._id,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!session)
    throw new UnauthorizedError('Please sign in to this store again');
  return profile(user);
}
async function refresh(tenant, token) {
  const data = tokens.verify(tenant, token, 'refresh');
  const user = await activeUser(tenant, data);
  const consumed = await RefreshToken.findOneAndUpdate(
    {
      jti: data.jti,
      tokenHash: tokens.hash(token),
      user: user._id,
      tenant: tenant._id,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    },
    {
      $set: {
        revokedAt: new Date(),
        revokeReason: 'refresh_rotation',
        rotated: true,
      },
    },
  );
  if (!consumed)
    throw new UnauthorizedError('Please sign in to this store again');
  const result = await issue(tenant, user);
  // Refresh responses do not need a profile; the client revalidates /me.
  return { token: result.token, refreshToken: result.refreshToken };
}
async function logout(tenant, token) {
  const data = tokens.verify(tenant, token, 'refresh');
  await RefreshToken.updateOne(
    {
      jti: data.jti,
      tokenHash: tokens.hash(token),
      user: data.userId,
      tenant: tenant._id,
    },
    { $set: { revokedAt: new Date(), revokeReason: 'logout' } },
  );
  return { message: 'Signed out' };
}
module.exports = { profile, activeUser, issue, me, refresh, logout };

'use strict';
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Challenge = require('../models/TenantCustomerChallenge');
const RefreshToken = require('../models/RefreshToken');
const mail = require('./email.service');
const tokens = require('./tenantCustomer.tokens');
const validate = require('./tenantCustomer.validation');
const { customerIdentity } = require('../utils/customerIdentity');
const { ValidationError } = require('../utils/errors');
const id = (tenant, user, kind) =>
  tokens.hash(`${tenant._id}:${user._id}:${kind}`);
const digest = (tenant, kind, value) =>
  tokens.hash(`${tenant._id}:${kind}:${value}`);
async function store(tenant, user, kind, value, ttl) {
  await Challenge.findOneAndUpdate(
    { _id: id(tenant, user, kind) },
    {
      $set: {
        tenant: tenant._id,
        user: user._id,
        kind,
        valueHash: digest(tenant, kind, value),
        attempts: 0,
        expiresAt: new Date(Date.now() + ttl),
      },
    },
    { upsert: true },
  );
}
async function consume(tenant, user, kind, value) {
  const query = {
    _id: id(tenant, user, kind),
    tenant: tenant._id,
    user: user._id,
    kind,
    attempts: { $lt: 5 },
    expiresAt: { $gt: new Date() },
  };
  const consumed = await Challenge.findOneAndDelete({
    ...query,
    valueHash: digest(tenant, kind, value),
  });
  if (!consumed) {
    await Challenge.updateOne(query, { $inc: { attempts: 1 } });
    throw new ValidationError('Invalid or expired verification code');
  }
}
async function sendVerification(tenant, user) {
  const code = String(crypto.randomInt(100000, 1000000));
  await store(tenant, user, 'verify', code, 600000);
  await mail.sendEmailVerificationEmail({
    email: user.email,
    firstName: user.firstName,
    code,
  });
}
async function resendVerification(tenant, body) {
  validate.fields(body, ['email']);
  const user = await User.findOne({
    ...customerIdentity(tenant),
    email: validate.email(body.email),
    status: 'active',
  });
  if (user && !user.isEmailVerified) {
    const recent = await Challenge.exists({
      _id: id(tenant, user, 'verify'),
      createdAt: { $gt: new Date(Date.now() - 60000) },
      expiresAt: { $gt: new Date() },
    });
    if (!recent)
      await sendVerification(tenant, user).catch(() =>
        console.error('Store verification email delivery failed'),
      );
  }
  return { message: 'If an account exists, a verification code has been sent' };
}
async function verifyEmail(tenant, body) {
  validate.fields(body, ['email', 'code']);
  const user = await User.findOne({
    ...customerIdentity(tenant),
    email: validate.email(body.email),
    status: 'active',
  });
  if (!user || typeof body.code !== 'string' || !/^\d{6}$/.test(body.code))
    throw new ValidationError('Invalid or expired verification code');
  await consume(tenant, user, 'verify', body.code);
  await User.updateOne(
    { _id: user._id, ...customerIdentity(tenant) },
    { $set: { isEmailVerified: true, emailVerifiedAt: new Date() } },
  );
  return { message: 'Email verified' };
}
async function forgotPassword(tenant, body) {
  validate.fields(body, ['email', 'returnOrigin']);
  const origin = validate.resetOrigin(tenant, body.returnOrigin);
  const user = await User.findOne({
    ...customerIdentity(tenant),
    email: validate.email(body.email),
    status: 'active',
  });
  if (user) {
    const value = crypto.randomBytes(32).toString('hex');
    await store(tenant, user, 'reset', value, 3600000);
    await mail
      .sendPasswordResetEmail({
        email: user.email,
        firstName: user.firstName,
        resetToken: value,
        resetUrl: `${origin}/reset-password?token=${value}`,
      })
      .catch(() => console.error('Store recovery email delivery failed'));
  }
  return {
    message: 'If an account exists, a password reset link has been sent',
  };
}
async function resetPassword(tenant, value, body) {
  validate.fields(body, ['newPassword']);
  validate.password(body.newPassword);
  if (typeof value !== 'string' || !/^[a-f\d]{64}$/.test(value))
    throw new ValidationError('Invalid or expired reset link');
  const challenge = await Challenge.findOne({
    tenant: tenant._id,
    kind: 'reset',
    valueHash: digest(tenant, 'reset', value),
    expiresAt: { $gt: new Date() },
  });
  const user =
    challenge &&
    (await User.findOne({
      _id: challenge.user,
      ...customerIdentity(tenant),
      status: 'active',
    }).select('+passwordHash'));
  if (!user) throw new ValidationError('Invalid or expired reset link');
  if (await bcrypt.compare(body.newPassword, user.passwordHash))
    throw new ValidationError('Choose a different password');
  const passwordHash = await bcrypt.hash(body.newPassword, 12);
  await consume(tenant, user, 'reset', value);
  await User.updateOne(
    { _id: user._id, ...customerIdentity(tenant), status: 'active' },
    {
      $set: {
        passwordHash,
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
        accountLockedUntil: null,
      },
    },
  );
  await RefreshToken.revokeAllForUser(user._id, user._id, 'password_change');
  // Any pending login challenge must also be invalidated by the password reset.
  await Challenge.deleteMany({
    tenant: tenant._id,
    user: user._id,
    kind: 'mfa',
  });
  return { message: 'Password updated' };
}
module.exports = {
  store,
  consume,
  sendVerification,
  resendVerification,
  verifyEmail,
  forgotPassword,
  resetPassword,
};

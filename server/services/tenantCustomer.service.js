'use strict';
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const sessions = require('./tenantCustomer.sessions');
const challenges = require('./tenantCustomer.challenges');
const tokens = require('./tenantCustomer.tokens');
const validate = require('./tenantCustomer.validation');
const { customerIdentity } = require('../utils/customerIdentity');
const {
  ValidationError,
  UnauthorizedError,
  ConflictError,
} = require('../utils/errors');
async function register(tenant, body) {
  validate.fields(body, [
    'email',
    'password',
    'firstName',
    'lastName',
    'phoneNumber',
  ]);
  const email = validate.email(body.email);
  validate.password(body.password);
  const data = {
    email,
    firstName: validate.text(body.firstName, 'first name'),
    lastName: validate.text(body.lastName, 'last name', 50, true),
    phone: validate.text(body.phoneNumber, 'phone number', 30, true),
    ...customerIdentity(tenant),
    status: 'active',
    isEmailVerified: false,
  };
  if (await User.exists({ email, ...customerIdentity(tenant) }))
    throw new ConflictError(
      'An account with this email already exists in this store',
    );
  data.passwordHash = await bcrypt.hash(body.password, 12);
  let user;
  try {
    user = await User.create(data);
  } catch (error) {
    if (error.code === 11000)
      throw new ConflictError(
        'An account with this email already exists in this store',
      );
    throw error;
  }
  // Account creation remains valid when email delivery is temporarily unavailable.
  await challenges
    .sendVerification(tenant, user)
    .catch(() =>
      console.error('Store customer verification email delivery failed'),
    );
  return sessions.issue(tenant, user);
}
async function login(tenant, body) {
  validate.fields(body, ['email', 'password']);
  const email = validate.email(body.email);
  validate.password(body.password, false);
  const query = { email, ...customerIdentity(tenant) };
  const user = await User.findOne(query).select('+passwordHash');
  if (!user || user.status !== 'active' || user.accountLockedUntil > new Date())
    throw new UnauthorizedError('Invalid email or password');
  if (
    !user.passwordHash ||
    !(await bcrypt.compare(body.password, user.passwordHash))
  ) {
    const attempts = await User.findOneAndUpdate(
      { _id: user._id, ...query },
      { $inc: { failedLoginAttempts: 1 }, $set: { lastFailedLoginIp: '' } },
      { new: true },
    );
    if (attempts.failedLoginAttempts >= 5)
      await User.updateOne(
        { _id: user._id, ...query },
        { $set: { accountLockedUntil: new Date(Date.now() + 900000) } },
      );
    throw new UnauthorizedError('Invalid email or password');
  }
  await User.updateOne(
    { _id: user._id, ...query },
    {
      $set: {
        failedLoginAttempts: 0,
        accountLockedUntil: null,
        lastLogin: new Date(),
      },
    },
  );
  if (user.mfaEnabled) {
    const jti = crypto.randomUUID();
    const pendingMfaToken = tokens.sign(
      tenant,
      user._id,
      'mfa',
      jti,
      '5m',
      user.passwordChangedAt?.getTime() || 0,
    );
    await challenges.store(tenant, user, 'mfa', pendingMfaToken, 300000);
    return { mfaRequired: true, pendingMfaToken, tenantId: String(tenant._id) };
  }
  return sessions.issue(tenant, user);
}
async function verifyMfa(tenant, body) {
  validate.fields(body, ['pendingMfaToken', 'code']);
  const data = tokens.verify(tenant, body.pendingMfaToken, 'mfa');
  const user = await sessions.activeUser(tenant, data);
  const withSecrets = await User.findOne({
    _id: user._id,
    ...customerIdentity(tenant),
    status: 'active',
    mfaEnabled: true,
  }).select('+mfaSecret +mfaBackupCodes');
  if (!withSecrets || typeof body.code !== 'string' || body.code.length > 40)
    throw new ValidationError('Invalid MFA code');
  const validTotp = require('./mfa.service').verifyTotp(
    withSecrets.mfaSecret,
    body.code,
  );
  const backup = (withSecrets.mfaBackupCodes || []).find(
    (code) => code.toUpperCase() === body.code.toUpperCase(),
  );
  if (!validTotp && !backup) {
    // Count failed MFA attempts without consuming a valid challenge.
    const Challenge = require('../models/TenantCustomerChallenge');
    await Challenge.updateOne(
      {
        tenant: tenant._id,
        user: user._id,
        kind: 'mfa',
        valueHash: tokens.hash(`${tenant._id}:mfa:${body.pendingMfaToken}`),
      },
      { $inc: { attempts: 1 } },
    );
    throw new ValidationError('Invalid MFA code');
  }
  await challenges.consume(tenant, user, 'mfa', body.pendingMfaToken);
  if (!validTotp) {
    const consumed = await User.updateOne(
      { _id: user._id, ...customerIdentity(tenant), mfaBackupCodes: backup },
      { $pull: { mfaBackupCodes: backup } },
    );
    if (!consumed.modifiedCount) throw new ValidationError('Invalid MFA code');
  }
  return sessions.issue(tenant, user);
}
module.exports = {
  register,
  login,
  verifyMfa,
  ...sessions,
  verifyEmail: challenges.verifyEmail,
  resendVerification: challenges.resendVerification,
  forgotPassword: challenges.forgotPassword,
  resetPassword: challenges.resetPassword,
};

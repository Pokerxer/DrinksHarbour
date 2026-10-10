'use strict';
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { UnauthorizedError, AppError } = require('../utils/errors');
const audience = 'drinksharbour:tenant-customer';
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
function secret() {
  if (!process.env.JWT_SECRET)
    throw new AppError('Customer accounts are unavailable', 503);
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(audience)
    .digest('hex');
}
function sign(tenant, userId, type, jti, expiresIn, pwdAt = 0) {
  return jwt.sign(
    { userId: String(userId), tenant: String(tenant._id), type, jti, pwdAt },
    secret(),
    { algorithm: 'HS256', audience, expiresIn },
  );
}
function verify(tenant, token, type) {
  try {
    const data = jwt.verify(token, secret(), {
      algorithms: ['HS256'],
      audience,
    });
    if (
      data.type !== type ||
      data.tenant !== String(tenant._id) ||
      !/^[a-f\d]{24}$/i.test(data.userId) ||
      typeof data.jti !== 'string'
    )
      throw new Error('scope');
    return data;
  } catch {
    throw new UnauthorizedError('Please sign in to this store again');
  }
}
module.exports = { sign, verify, hash };

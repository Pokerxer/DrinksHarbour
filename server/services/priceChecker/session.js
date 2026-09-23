const jwt = require('jsonwebtoken');
const { UnauthorizedError } = require('../../utils/errors');
const { id } = require('./validation');
function secret() {
  const value = process.env.PRICE_CHECKER_SESSION_SECRET || process.env.JWT_SECRET;
  if (!value) throw new Error('Kiosk session signing is not configured.');
  return require('crypto')
    .createHmac('sha256', value)
    .update('drinksharbour:price-checker:v1')
    .digest('hex');
}
function issueSession(kiosk) {
  return jwt.sign({ kiosk: String(kiosk._id), version: kiosk.version }, secret(), {
    algorithm: 'HS256',
    audience: 'price-checker',
    issuer: 'drinksharbour',
    expiresIn: '1h',
  });
}
function verifySession(token) {
  try {
    const claims = jwt.verify(token, secret(), {
      algorithms: ['HS256'],
      audience: 'price-checker',
      issuer: 'drinksharbour',
    });
    id(claims.kiosk);
    if (!Number.isInteger(claims.version) || !claims.exp) throw new Error();
    return claims;
  } catch {
    throw new UnauthorizedError('Kiosk session expired.');
  }
}
module.exports = { issueSession, verifySession };

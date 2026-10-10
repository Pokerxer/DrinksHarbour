'use strict';
const { ValidationError } = require('../utils/errors');
function fields(body, allowed) {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => !allowed.includes(key))
  )
    throw new ValidationError('Invalid account details');
}
function email(value) {
  if (
    typeof value !== 'string' ||
    value.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  )
    throw new ValidationError('Please provide a valid email address');
  return value.trim().toLowerCase();
}
function password(value, strong = true) {
  if (
    typeof value !== 'string' ||
    value.length > 128 ||
    value.length < (strong ? 8 : 1) ||
    (strong && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s])/.test(value))
  )
    throw new ValidationError(
      'Use 8–128 characters with uppercase, lowercase, a number and a symbol',
    );
  // bcrypt considers only the first 72 bytes. Reject rather than silently truncate.
  if (Buffer.byteLength(value) > 72)
    throw new ValidationError('Password must be at most 72 bytes');
  return value;
}
function text(value, name, max = 50, optional = false) {
  if (optional && value === undefined) return '';
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new ValidationError(`Check your ${name}`);
  return value.trim();
}
function resetOrigin(tenant, requested) {
  const fallback = `https://${tenant.slug}.drinksharbour.com`;
  let allowed;
  try {
    allowed =
      JSON.parse(process.env.TENANT_CUSTOMER_ORIGINS || '{}')[tenant.slug] ||
      [];
  } catch {
    throw new ValidationError('Store recovery links have not been configured');
  }
  if (!Array.isArray(allowed))
    throw new ValidationError('Store recovery links have not been configured');
  if (!requested) return fallback;
  let url;
  try {
    url = new URL(requested);
  } catch {
    throw new ValidationError('Invalid store origin');
  }
  const local =
    process.env.NODE_ENV !== 'production' &&
    ['http://localhost:3002', 'http://127.0.0.1:3002'].includes(url.origin);
  if (
    url.origin !== requested ||
    url.username ||
    url.password ||
    (!local &&
      (url.protocol !== 'https:' ||
        ![fallback, ...allowed].includes(url.origin)))
  )
    throw new ValidationError('Store recovery origin is not allowed');
  return url.origin;
}
module.exports = { fields, email, password, text, resetOrigin };

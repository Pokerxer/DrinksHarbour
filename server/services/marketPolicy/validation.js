'use strict';
const mongoose = require('mongoose');
const { normalizeCode } = require('../country/validation');
const { AppError } = require('../../utils/errors');
const error = (message, statusCode = 400, code = 'MARKET_INVALID') => Object.assign(new AppError(message, statusCode), { code });
function fields(input, allowed) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw error('An input object is required');
  if (Object.keys(input).some(key => !allowed.includes(key))) throw error('Unsupported input field');
}
function text(value, label) {
  if (typeof value !== 'string' || value.trim().length < 5 || value.length > 1000) throw error(`${label} must contain 5–1000 characters`);
  return value.trim();
}
function id(value, label = 'tenant') {
  const raw = value?._id || value;
  if (!mongoose.isObjectIdOrHexString(raw)) throw error(`A stable ${label} ID is required`);
  return String(raw);
}
function scope(input) {
  if (!['beverage', 'gift', 'food'].includes(input.category)) throw error('Unsupported market category');
  if (!['marketplace', 'storefront'].includes(input.channel)) throw error('Unsupported enrollment channel');
  return { market: normalizeCode(input.market), category: input.category, channel: input.channel };
}
function version(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw error('expectedVersion must be a nonnegative integer');
  return value;
}
function term(input) {
  if (typeof input.effectiveFrom !== 'string' || typeof input.effectiveUntil !== 'string') throw error('Explicit start and end dates are required');
  const effectiveFrom = new Date(input.effectiveFrom), effectiveUntil = new Date(input.effectiveUntil);
  if (!Number.isFinite(+effectiveFrom) || !Number.isFinite(+effectiveUntil) || effectiveFrom >= effectiveUntil) throw error('Invalid date term');
  return { effectiveFrom, effectiveUntil };
}
function admin(actor) {
  if (actor?.role !== 'super_admin') throw error('Super-admin authority required', 403, 'MARKET_FORBIDDEN');
  id(actor?._id, 'actor');
}
function owner(actor) {
  if (!['tenant_owner', 'tenant_admin'].includes(actor?.role)) throw error('Tenant owner authority required', 403, 'MARKET_FORBIDDEN');
  id(actor?._id, 'actor');
  return id(actor?.tenant);
}
module.exports = { error, fields, text, id, scope, version, term, admin, owner };

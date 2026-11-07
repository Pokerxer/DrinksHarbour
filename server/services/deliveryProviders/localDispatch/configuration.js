'use strict';
const Warehouse = require('../../../models/Warehouse');
const Contract = require('../../../models/MerchantLocalDispatchContract');
const { ValidationError, NotFoundError } = require('../../../utils/errors');
const { platform } = require('./review');
const text = value => typeof value === 'string' ? value : '';
const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const date = value => value instanceof Date && Number.isFinite(value.getTime()) ? value : null;
const oid = value => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
function pagination(query = {}) {
  if (Object.keys(query).some(k => !['page', 'limit'].includes(k))) throw new ValidationError('Unsupported configuration filter');
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 25 : Number(query.limit);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw new ValidationError('Invalid configuration pagination');
  return { page, limit };
}
function contractDTO(row) {
  if (!row) return null;
  return {
    _id: String(row._id), tenant: String(row.tenant), location: String(row.location),
    version: number(row.version), status: text(row.status), currency: text(row.currency),
    amountMinor: number(row.amountMinor), maxUnits: number(row.maxUnits), maxWeightGrams: number(row.maxWeightGrams),
    vehicleTypes: (Array.isArray(row.vehicleTypes) ? row.vehicleTypes : []).filter(v => ['bike', 'tricycle', 'car', 'van', 'truck'].includes(v)),
    coverage: (Array.isArray(row.coverage) ? row.coverage : []).filter(r => r && typeof r === 'object').map(r => ({ country: text(r.country), state: text(r.state), city: text(r.city), minLat: number(r.minLat), maxLat: number(r.maxLat), minLon: number(r.minLon), maxLon: number(r.maxLon) })),
    capabilities: { alcohol: row.capabilities?.alcohol === true, ageVerification: row.capabilities?.ageVerification === true, fragile: row.capabilities?.fragile === true },
    reviewReference: text(row.reviewReference), reviewedAt: date(row.reviewedAt), validUntil: date(row.validUntil),
    ...(row.revokedAt ? { revokedAt: date(row.revokedAt) } : {}),
  };
}
async function listConfigurationLocations(query, actor) {
  platform(actor);
  const { page, limit } = pagination(query);
  const filter = { isActive: true };
  const [rows, total] = await Promise.all([
    Warehouse.find(filter).sort({ name: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).select('_id tenant name code').lean(),
    Warehouse.countDocuments(filter),
  ]);
  const tenants = await require('../../../models/Tenant').find({ _id: { $in: rows.map(r => r.tenant) } }).select('_id name businessName').lean();
  const names = new Map(tenants.map(r => [String(r._id), text(r.name) || text(r.businessName) || 'Merchant']));
  return { locations: rows.map(r => ({ _id: String(r._id), tenant: String(r.tenant), name: text(r.name), code: text(r.code), tenantName: names.get(String(r.tenant)) || 'Merchant' })), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}
async function getConfiguration(tenant, location, query, actor) {
  platform(actor);
  const { page, limit } = pagination(query);
  if (!oid(tenant) || !oid(location)) throw new ValidationError('Invalid configuration location');
  const saved = await Warehouse.findOne({ _id: location, tenant, isActive: true }).select('_id tenant name code').lean();
  if (!saved) throw new NotFoundError('Configuration location not found');
  const filter = { tenant, location };
  const [latest, rows, total] = await Promise.all([
    Contract.findOne(filter).sort({ version: -1 }).lean(),
    Contract.find(filter).sort({ version: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Contract.countDocuments(filter),
  ]);
  return { location: { _id: String(saved._id), tenant: String(saved.tenant), name: text(saved.name), code: text(saved.code) }, creationEnabled: process.env.MERCHANT_LOCAL_DISPATCH_ENABLED === 'true', state: !latest ? 'unavailable' : latest.status === 'revoked' ? 'revoked' : new Date(latest.validUntil) <= new Date() ? 'expired' : 'reviewed', latest: contractDTO(latest), contracts: rows.map(contractDTO), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}
module.exports = { listConfigurationLocations, getConfiguration, contractDTO };

const Tenant = require('../models/Tenant');
const { getTenantId } = require('../utils/tenantContext');
const { NotFoundError } = require('../utils/errors');
const { defaults, validatePreferences } = require('../config/document-templates');

async function read(req, res) {
  const tenant = await Tenant.findOne({ _id: getTenantId(req) }).select('documentTemplates').lean();
  if (!tenant) throw new NotFoundError('Tenant not found');
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data: tenant.documentTemplates ?? defaults() });
}
async function update(req, res) {
  const preferences = validatePreferences(req.body);
  const result = await Tenant.updateOne({ _id: getTenantId(req) }, { $set: { documentTemplates: preferences } }, { runValidators: true });
  if (!result.matchedCount) throw new NotFoundError('Tenant not found');
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data: preferences });
}
module.exports = { read, update };

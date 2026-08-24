// controllers/tax.controller.js
const asyncHandler = require('../utils/asyncHandler');
const Tax = require('../models/Tax');
const TaxRecord = require('../models/TaxRecord');
const { getSummary } = require('../services/tax.service');

const VALID_APPLIES_TO = ['sale', 'purchase', 'transfer', 'return'];

// Creating/updating a default unsets the previous default of the same
// (type, context) pair so `getDefaultTax` always resolves to exactly one tax.
async function enforceSingleDefault(taxDoc, userId) {
  if (!taxDoc.isDefault || !taxDoc.isActive) return;
  await Tax.updateMany(
    {
      _id: { $ne: taxDoc._id },
      tenant: taxDoc.tenant,
      type: taxDoc.type,
      isActive: true,
      isDefault: true,
      appliesTo: { $in: taxDoc.appliesTo },
    },
    { $set: { isDefault: false }, updatedBy: userId }
  );
}

exports.createTax = asyncHandler(async (req, res) => {
  const tenantId = req.tenant._id;
  const { name, rate, type, appliesTo, isDefault, isActive } = req.body;

  if (!name || typeof rate !== 'number' || !['output', 'input'].includes(type)) {
    return res.status(400).json({ success: false, message: 'name, numeric rate and type (output|input) are required' });
  }
  const list = Array.isArray(appliesTo) && appliesTo.length
    ? appliesTo.filter((f) => VALID_APPLIES_TO.includes(f))
    : VALID_APPLIES_TO;

  const exists = await Tax.findOne({ tenant: tenantId, name: String(name).trim() });
  if (exists) return res.status(400).json({ success: false, message: `A tax named "${name}" already exists` });

  const tax = await Tax.create({
    tenant: tenantId,
    name: String(name).trim(),
    rate,
    type,
    appliesTo: list,
    isDefault: !!isDefault,
    isActive: isActive !== false,
    createdBy: req.user._id,
  });
  await enforceSingleDefault(tax, req.user._id);
  res.status(201).json({ success: true, data: tax });
});

exports.getTaxes = asyncHandler(async (req, res) => {
  const tenantId = req.tenant._id;
  const { type, isActive, appliesTo } = req.query;
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

  const filter = { tenant: tenantId };
  if (type) filter.type = type;
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (appliesTo) filter.appliesTo = appliesTo;

  const [data, total] = await Promise.all([
    Tax.find(filter).populate('createdBy', 'name').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Tax.countDocuments(filter),
  ]);
  res.json({ success: true, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

exports.updateTax = asyncHandler(async (req, res) => {
  const tenantId = req.tenant._id;
  const tax = await Tax.findOne({ _id: req.params.id, tenant: tenantId });
  if (!tax) return res.status(404).json({ success: false, message: 'Tax not found' });

  const allowed = ['name', 'rate', 'type', 'appliesTo', 'isDefault', 'isActive'];
  for (const key of allowed) if (req.body[key] !== undefined) tax[key] = req.body[key];
  tax.updatedBy = req.user._id;

  if (req.body.name) {
    const dupe = await Tax.findOne({ tenant: tenantId, name: String(req.body.name).trim(), _id: { $ne: tax._id } });
    if (dupe) return res.status(400).json({ success: false, message: `A tax named "${req.body.name}" already exists` });
  }

  await tax.save();
  await enforceSingleDefault(tax, req.user._id);
  res.json({ success: true, data: tax });
});

exports.deleteTax = asyncHandler(async (req, res) => {
  const tenantId = req.tenant._id;
  const tax = await Tax.findOne({ _id: req.params.id, tenant: tenantId });
  if (!tax) return res.status(404).json({ success: false, message: 'Tax not found' });

  const referenced = await TaxRecord.countDocuments({ tenant: tenantId, tax: tax._id });
  if (referenced > 0) {
    return res.status(409).json({
      success: false,
      message: `"${tax.name}" is referenced by ${referenced} tax record(s). Deactivate it instead.`,
    });
  }
  await tax.deleteOne();
  res.json({ success: true, message: 'Tax deleted' });
});

exports.getTaxRecords = asyncHandler(async (req, res) => {
  const tenantId = req.tenant._id;
  const { sourceType, status, from, to } = req.query;
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

  const filter = { tenant: tenantId };
  if (sourceType) filter.sourceType = sourceType;
  if (status) filter.status = status;
  if (from || to) {
    filter.postedAt = {};
    if (from) filter.postedAt.$gte = new Date(from);
    if (to) filter.postedAt.$lte = new Date(to);
  }

  const [data, total] = await Promise.all([
    TaxRecord.find(filter).sort({ postedAt: -1 }).skip((page - 1) * limit).limit(limit),
    TaxRecord.countDocuments(filter),
  ]);
  res.json({ success: true, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

exports.getTaxSummary = asyncHandler(async (req, res) => {
  const data = await getSummary(req.tenant._id, { from: req.query.from, to: req.query.to });
  res.json({ success: true, data });
});

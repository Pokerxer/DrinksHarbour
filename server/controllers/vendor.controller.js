// controllers/vendor.controller.js
const asyncHandler = require('express-async-handler');
const Vendor = require('../models/Vendor');
const { NotFoundError, ValidationError, ForbiddenError } = require('../utils/errors');

/**
 * Helper to get tenant ID
 */
const resolveTenantId = async (req) => {
  if (req.tenant?._id) return req.tenant._id;
  
  if (req.user?.tenant) {
    const userTenant = req.user.tenant;
    const tenantId = typeof userTenant === 'object' && userTenant._id ? userTenant._id : userTenant;
    return tenantId;
  }
  
  throw new ForbiddenError('Tenant context required');
};

// @desc    Create new vendor
// @route   POST /api/vendors
// @access  Private (Tenant admin)
const createVendor = asyncHandler(async (req, res) => {
  const { name, email, phone, address, contactPerson, bankDetails, paymentTerms, notes, isActive, taxId, website } = req.body;

  const tenantId = await resolveTenantId(req);

  // Check if vendor with same name already exists
  const existingVendor = await Vendor.findOne({ tenant: tenantId, name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
  if (existingVendor) {
    throw new ValidationError('Vendor with this name already exists');
  }

  const vendor = await Vendor.create({
    tenant: tenantId,
    name: name.trim(),
    email: email?.trim() || null,
    phone: phone?.trim() || null,
    address: address || {},
    contactPerson: contactPerson || {},
    bankDetails: bankDetails || {},
    paymentTerms: paymentTerms || 'net_30',
    notes: notes || null,
    isActive: isActive !== undefined ? isActive : true,
    taxId: taxId?.trim() || null,
    website: website?.trim() || null,
  });

  res.status(201).json({
    success: true,
    data: vendor,
  });
});

// @desc    Search vendors
// @route   GET /api/vendors/search
// @access  Private (Tenant admin)
const searchVendors = asyncHandler(async (req, res) => {
  const { q, limit = 10 } = req.query;
  const tenantId = await resolveTenantId(req);

  if (!q || q.trim().length < 2) {
    return res.status(200).json({
      success: true,
      vendors: [],
    });
  }

  const vendors = await Vendor.find({
    tenant: tenantId,
    isActive: true,
    $or: [
      { name: { $regex: new RegExp(q.trim(), 'i') } },
      { email: { $regex: new RegExp(q.trim(), 'i') } },
      { phone: { $regex: new RegExp(q.trim(), 'i') } },
    ],
  })
    .limit(parseInt(limit) || 10)
    .lean();

  res.status(200).json({
    success: true,
    vendors,
  });
});

// @desc    Get vendor by ID
// @route   GET /api/vendors/:id
// @access  Private (Tenant admin)
const getVendor = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = await resolveTenantId(req);

  const vendor = await Vendor.findOne({ _id: id, tenant: tenantId }).lean();

  if (!vendor) {
    throw new NotFoundError('Vendor not found');
  }

  res.status(200).json({
    success: true,
    data: vendor,
  });
});

// @desc    Get all active vendors
// @route   GET /api/vendors
// @access  Private (Tenant admin)
const getAllVendors = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);

  const vendors = await Vendor.find({ tenant: tenantId, isActive: true })
    .sort({ name: 1 })
    .lean();

  res.status(200).json({
    success: true,
    data: vendors,
  });
});

// @desc    Update vendor
// @route   PUT /api/vendors/:id
// @access  Private (Tenant admin)
const updateVendor = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = await resolveTenantId(req);

  let vendor = await Vendor.findOne({ _id: id, tenant: tenantId });

  if (!vendor) {
    throw new NotFoundError('Vendor not found');
  }

  const updates = {
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone,
    address: req.body.address,
    contactPerson: req.body.contactPerson,
    bankDetails: req.body.bankDetails,
    paymentTerms: req.body.paymentTerms,
    notes: req.body.notes,
    isActive: req.body.isActive,
    taxId: req.body.taxId,
    website: req.body.website,
  };

  // Remove undefined values
  Object.keys(updates).forEach((key) => {
    if (updates[key] === undefined) delete updates[key];
  });

  vendor = await Vendor.findByIdAndUpdate(id, updates, { new: true });

  res.status(200).json({
    success: true,
    data: vendor,
  });
});

// @desc    Delete vendor
// @route   DELETE /api/vendors/:id
// @access  Private (Tenant admin)
const deleteVendor = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = await resolveTenantId(req);

  const vendor = await Vendor.findOne({ _id: id, tenant: tenantId });

  if (!vendor) {
    throw new NotFoundError('Vendor not found');
  }

  await Vendor.findByIdAndDelete(id);

  res.status(200).json({
    success: true,
    message: 'Vendor deleted successfully',
  });
});

module.exports = {
  createVendor,
  searchVendors,
  getVendor,
  getAllVendors,
  updateVendor,
  deleteVendor,
};

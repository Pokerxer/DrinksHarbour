// controllers/tenant.controller.js

const asyncHandler = require('../utils/asyncHandler');
const Tenant = require('../models/Tenant');
const cloudinaryService = require('../services/cloudinary.service');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toBool(v, fallback = false) {
  if (v === undefined || v === null) return fallback;
  if (typeof v === 'boolean') return v;
  return v === 'true' || v === '1';
}

async function uploadTenantFile(file, altText) {
  const result = await cloudinaryService.uploadImage(file.buffer, {
    folder: 'tenants',
    tags: ['tenant'],
  });
  return { url: result.url, publicId: result.publicId, alt: altText };
}

function buildTenantData(b, isUpdate = false) {
  const data = {};

  if (b.name !== undefined) data.name = b.name;
  if (b.slug !== undefined) data.slug = b.slug;
  if (b.contactEmail !== undefined) data.contactEmail = b.contactEmail;
  if (b.contactPhone !== undefined) data.contactPhone = b.contactPhone;
  if (b.primaryColor !== undefined) data.primaryColor = b.primaryColor;
  if (b.notes !== undefined) data.notes = b.notes;
  if (b.customPricingNote !== undefined) data.customPricingNote = b.customPricingNote;
  if (b.country !== undefined) data.country = b.country;
  if (b.rejectionReason !== undefined) data.rejectionReason = b.rejectionReason;
  if (b.stripeCustomerId !== undefined) data.stripeCustomerId = b.stripeCustomerId;
  if (b.stripeSubscriptionId !== undefined) data.stripeSubscriptionId = b.stripeSubscriptionId;

  // Enum fields
  if (b.plan !== undefined) data.plan = b.plan;
  if (b.subscriptionStatus !== undefined) data.subscriptionStatus = b.subscriptionStatus;
  if (b.revenueModel !== undefined) data.revenueModel = b.revenueModel;
  if (b.status !== undefined) data.status = b.status;
  if (b.defaultCurrency !== undefined) data.defaultCurrency = b.defaultCurrency;

  // Date fields
  if (b.trialEndsAt) data.trialEndsAt = new Date(b.trialEndsAt);
  if (b.currentPeriodStart) data.currentPeriodStart = new Date(b.currentPeriodStart);
  if (b.currentPeriodEnd) data.currentPeriodEnd = new Date(b.currentPeriodEnd);

  // Number fields
  if (b.markupPercentage !== undefined) data.markupPercentage = Number(b.markupPercentage);
  if (b.commissionPercentage !== undefined) data.commissionPercentage = Number(b.commissionPercentage);
  if (b.platformMarkupPercentage !== undefined) data.platformMarkupPercentage = Number(b.platformMarkupPercentage);

  // Boolean fields
  if (b.enforceAgeVerification !== undefined) data.enforceAgeVerification = toBool(b.enforceAgeVerification, true);
  if (b.isSystemTenant !== undefined) data.isSystemTenant = toBool(b.isSystemTenant, false);

  // Supported currencies (comma-separated string)
  if (b.supportedCurrencies !== undefined) {
    data.supportedCurrencies = String(b.supportedCurrencies)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Address (flat fields -> nested object)
  const addressFields = {
    street: b.addressStreet,
    city: b.addressCity,
    lga: b.addressLga,
    state: b.addressState,
    zipCode: b.addressZipCode,
    country: b.addressCountry,
  };
  const hasAddress = Object.values(addressFields).some((v) => v !== undefined);
  if (hasAddress) {
    data.address = {};
    if (addressFields.street !== undefined) data.address.street = addressFields.street;
    if (addressFields.city !== undefined) data.address.city = addressFields.city;
    if (addressFields.lga !== undefined) data.address.lga = addressFields.lga;
    if (addressFields.state !== undefined) data.address.state = addressFields.state;
    if (addressFields.zipCode !== undefined) data.address.zipCode = addressFields.zipCode;
    if (addressFields.country !== undefined) data.address.country = addressFields.country;
  }

  // Purchase settings (flat ps* fields -> nested object)
  const psFields = {
    billControlPolicy: b.psBillControlPolicy,
    enable3WayMatching: b.psEnable3WayMatching,
    requirePOApproval: b.psRequirePOApproval,
    approvalThreshold: b.psApprovalThreshold,
    defaultPaymentTerms: b.psDefaultPaymentTerms,
    autoGenerateBill: b.psAutoGenerateBill,
    allowPartialReceipts: b.psAllowPartialReceipts,
    defaultReceivingLocation: b.psDefaultReceivingLocation,
  };
  const hasPsFields = Object.values(psFields).some((v) => v !== undefined);
  if (hasPsFields) {
    data.purchaseSettings = {};
    if (psFields.billControlPolicy !== undefined) data.purchaseSettings.billControlPolicy = psFields.billControlPolicy;
    if (psFields.enable3WayMatching !== undefined) data.purchaseSettings.enable3WayMatching = toBool(psFields.enable3WayMatching, true);
    if (psFields.requirePOApproval !== undefined) data.purchaseSettings.requirePOApproval = toBool(psFields.requirePOApproval, true);
    if (psFields.approvalThreshold !== undefined) data.purchaseSettings.approvalThreshold = Number(psFields.approvalThreshold);
    if (psFields.defaultPaymentTerms !== undefined) data.purchaseSettings.defaultPaymentTerms = psFields.defaultPaymentTerms;
    if (psFields.autoGenerateBill !== undefined) data.purchaseSettings.autoGenerateBill = toBool(psFields.autoGenerateBill, false);
    if (psFields.allowPartialReceipts !== undefined) data.purchaseSettings.allowPartialReceipts = toBool(psFields.allowPartialReceipts, true);
    if (psFields.defaultReceivingLocation !== undefined) data.purchaseSettings.defaultReceivingLocation = psFields.defaultReceivingLocation;
  }

  return data;
}

// ─── Admin CRUD handlers ──────────────────────────────────────────────────────

/**
 * @route GET /api/tenants/admin
 * @access Private (admin)
 */
exports.getAdminTenants = asyncHandler(async (req, res) => {
  const tenants = await Tenant.find()
    .select('name slug plan subscriptionStatus status revenueModel markupPercentage commissionPercentage platformMarkupPercentage logo primaryColor contactEmail contactPhone country isSystemTenant createdAt')
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({
    success: true,
    data: { tenants, total: tenants.length },
  });
});

/**
 * @route GET /api/tenants/admin/:id
 * @access Private (admin)
 */
exports.getAdminTenantById = asyncHandler(async (req, res) => {
  const tenant = await Tenant.findById(req.params.id).lean();
  if (!tenant) {
    return res.status(404).json({ success: false, message: 'Tenant not found' });
  }
  res.status(200).json({ success: true, data: { tenant } });
});

/**
 * @route POST /api/tenants/admin
 * @access Private (admin)
 */
exports.createAdminTenant = asyncHandler(async (req, res) => {
  const tenantData = buildTenantData(req.body, false);

  if (req.files?.logo?.[0]) {
    tenantData.logo = await uploadTenantFile(req.files.logo[0], req.body.name || 'Tenant logo');
  }

  const tenant = new Tenant(tenantData);
  await tenant.save();

  res.status(201).json({ success: true, data: { tenant } });
});

/**
 * @route PUT /api/tenants/admin/:id
 * @access Private (admin)
 */
exports.updateAdminTenant = asyncHandler(async (req, res) => {
  const updateData = buildTenantData(req.body, true);

  if (req.files?.logo?.[0]) {
    updateData.logo = await uploadTenantFile(req.files.logo[0], req.body.name || 'Tenant logo');
  }

  const tenant = await Tenant.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true, runValidators: true }
  );

  if (!tenant) {
    return res.status(404).json({ success: false, message: 'Tenant not found' });
  }

  res.status(200).json({ success: true, data: { tenant } });
});

/**
 * @route DELETE /api/tenants/admin/:id
 * @access Private (admin)
 */
exports.deleteAdminTenant = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const tenant = await Tenant.findById(id);
  if (!tenant) {
    return res.status(404).json({ success: false, message: 'Tenant not found' });
  }

  if (tenant.isSystemTenant) {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete a system tenant.',
    });
  }

  await Tenant.findByIdAndDelete(id);

  res.status(200).json({ success: true, message: 'Tenant deleted' });
});

/**
 * @route GET /api/tenants/slug/:slug
 * @access Public (no auth required)
 */
exports.getTenantBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const tenant = await Tenant.findOne({ slug, status: 'approved' })
    .select('name slug logo primaryColor plan subscriptionStatus status isSystemTenant enforceAgeVerification contactEmail contactPhone country defaultCurrency')
    .lean();
  if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });
  res.json({ success: true, data: { tenant } });
});

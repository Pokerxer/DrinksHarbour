// controllers/tenant.controller.js

const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const asyncHandler = require('../utils/asyncHandler');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const cloudinaryService = require('../services/cloudinary.service');
const emailService = require('../services/email.service');
const { logPrivilegedAction } = require('../utils/auditLog');
const { isVenueBusinessType } = require('../services/posVenue.service');

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

/**
 * Flatten nested plain objects into dot-notation paths.
 *
 * Mongoose does NOT flatten nested paths in updates — `$set: { address: {...} }`
 * REPLACES the whole sub-document, silently dropping every key the caller didn't
 * send (e.g. address.formatted from the geocoder, or the purchaseSettings the
 * admin form doesn't expose). Dot paths give us merge semantics instead.
 *
 * Only plain `{}` objects are descended into. Everything else — arrays, Dates,
 * ObjectIds, Buffers — is a leaf to be replaced wholesale. Descending into an
 * ObjectId would otherwise shred it into `approvedBy.buffer.0`-style byte paths.
 */
function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function flattenForUpdate(obj, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value)) {
      flattenForUpdate(value, path, out);
    } else {
      out[path] = value;
    }
  }
  return out;
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

  // Billing provider IDs — Paystack (the platform's gateway; there are no
  // Stripe fields on the Tenant schema)
  if (b.paystackCustomerId !== undefined) data.paystackCustomerId = b.paystackCustomerId;
  if (b.paystackSubscriptionCode !== undefined) data.paystackSubscriptionCode = b.paystackSubscriptionCode;
  if (b.paystackPlanCode !== undefined) data.paystackPlanCode = b.paystackPlanCode;

  // Business registration & compliance (also captured by the public apply form)
  if (b.businessType !== undefined) data.businessType = b.businessType || undefined;
  if (b.cacNumber !== undefined) data.cacNumber = b.cacNumber;
  if (b.tin !== undefined) data.tin = b.tin;
  if (b.idType !== undefined) data.idType = b.idType;
  if (b.idNumber !== undefined) data.idNumber = b.idNumber;
  if (b.nafdacNumber !== undefined) data.nafdacNumber = b.nafdacNumber;
  if (b.nafdacRequired !== undefined) data.nafdacRequired = toBool(b.nafdacRequired, false);
  if (b.applicationDescription !== undefined) data.applicationDescription = b.applicationDescription;

  // Settlement bank account. `bvn` is deliberately NOT accepted here — it is KYC
  // input captured at application time, not something an admin should retype.
  if (b.bankName !== undefined) data.bankName = b.bankName;
  if (b.bankAccountNumber !== undefined) data.bankAccountNumber = b.bankAccountNumber;
  if (b.bankAccountName !== undefined) data.bankAccountName = b.bankAccountName;

  // Payment accounts shown on POS invoices — sent as a JSON array string
  if (b.bankAccounts !== undefined) {
    let parsed = b.bankAccounts;
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        parsed = null;
      }
    }
    if (Array.isArray(parsed)) {
      data.bankAccounts = parsed
        .map((a) => ({
          bankName: (a?.bankName || '').trim(),
          accountNumber: (a?.accountNumber || '').trim(),
          accountName: (a?.accountName || '').trim(),
        }))
        .filter((a) => a.bankName || a.accountNumber || a.accountName);
    }
  }

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
  // Pack rates are nullable — empty string/null clears them (packs revert to normal rates)
  if (b.packMarkupPercentage !== undefined) {
    data.packMarkupPercentage = b.packMarkupPercentage === '' || b.packMarkupPercentage === null ? null : Number(b.packMarkupPercentage);
  }
  if (b.packCommissionPercentage !== undefined) {
    data.packCommissionPercentage = b.packCommissionPercentage === '' || b.packCommissionPercentage === null ? null : Number(b.packCommissionPercentage);
  }
  if (b.packRateMinUnits !== undefined) data.packRateMinUnits = Number(b.packRateMinUnits) || 2;

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

  // Purchase settings (flat ps* fields -> nested canonical object)
  const psFields = {
    defaultBillControlPolicy: b.psDefaultBillControlPolicy ?? b.psBillControlPolicy,
    defaultCurrency: b.psDefaultCurrency,
    requirePOApproval: b.psRequirePOApproval,
    approvalThreshold: b.psApprovalThreshold,
    enable3WayMatching: b.psEnable3WayMatching,
    autoGenerateBill: b.psAutoGenerateBill,
    allowPartialReceipts: b.psAllowPartialReceipts,
    rfqValidityDays: b.psRfqValidityDays,
    defaultLeadTimeDays: b.psDefaultLeadTimeDays,
    defaultPaymentTerms: b.psDefaultPaymentTerms,
    defaultReceivingLocation: b.psDefaultReceivingLocation,
    lockConfirmedOrders: b.psLockConfirmedOrders,
  };
  const hasPsFields = Object.values(psFields).some((v) => v !== undefined);
  if (hasPsFields) {
    data.purchaseSettings = {};
    if (psFields.defaultBillControlPolicy !== undefined) data.purchaseSettings.defaultBillControlPolicy = psFields.defaultBillControlPolicy;
    if (psFields.defaultCurrency !== undefined) data.purchaseSettings.defaultCurrency = psFields.defaultCurrency;
    if (psFields.requirePOApproval !== undefined) data.purchaseSettings.requirePOApproval = toBool(psFields.requirePOApproval, true);
    if (psFields.approvalThreshold !== undefined) data.purchaseSettings.approvalThreshold = Number(psFields.approvalThreshold);
    if (psFields.enable3WayMatching !== undefined) data.purchaseSettings.enable3WayMatching = toBool(psFields.enable3WayMatching, true);
    if (psFields.autoGenerateBill !== undefined) data.purchaseSettings.autoGenerateBill = toBool(psFields.autoGenerateBill, false);
    if (psFields.allowPartialReceipts !== undefined) data.purchaseSettings.allowPartialReceipts = toBool(psFields.allowPartialReceipts, true);
    if (psFields.rfqValidityDays !== undefined) data.purchaseSettings.rfqValidityDays = Number(psFields.rfqValidityDays);
    if (psFields.defaultLeadTimeDays !== undefined) data.purchaseSettings.defaultLeadTimeDays = Number(psFields.defaultLeadTimeDays);
    if (psFields.defaultPaymentTerms !== undefined) data.purchaseSettings.defaultPaymentTerms = psFields.defaultPaymentTerms;
    if (psFields.defaultReceivingLocation !== undefined) data.purchaseSettings.defaultReceivingLocation = psFields.defaultReceivingLocation;
    if (psFields.lockConfirmedOrders !== undefined) data.purchaseSettings.lockConfirmedOrders = toBool(psFields.lockConfirmedOrders, false);
  }

  return data;
}

// Address paths that, when changed, make the stored coordinates stale
const GEOCODED_ADDRESS_PATHS = ['address.street', 'address.city', 'address.lga', 'address.state'];

/**
 * Re-run geocoding when an update touched the address.
 *
 * The geocoder lives in a `pre('save')` hook, which findOneAndUpdate never
 * fires — without this, editing a tenant's address leaves location.lat/lon
 * pointing at the old address, and those coordinates drive shipping distance.
 * Failures are non-fatal: the address itself is already saved.
 */
async function regeocodeIfAddressChanged(tenant, flatUpdate, before) {
  const changed = GEOCODED_ADDRESS_PATHS.some((path) => {
    if (!(path in flatUpdate)) return false;
    const key = path.split('.')[1];
    return (before?.address?.[key] || '') !== (flatUpdate[path] || '');
  });
  if (!changed) return;

  try {
    await tenant.geocode();
  } catch (err) {
    console.warn('[Tenant] Re-geocode after admin update failed:', err.message);
  }
}

/** Friendly message for a duplicate-slug write instead of a raw E11000 dump. */
function isDuplicateSlugError(err) {
  return err?.code === 11000 && Object.keys(err.keyPattern || err.keyValue || {}).includes('slug');
}

// Pure helpers, exported for unit tests
exports.buildTenantData = buildTenantData;
exports.flattenForUpdate = flattenForUpdate;

// ─── Admin CRUD handlers ──────────────────────────────────────────────────────

/**
 * @route GET /api/tenants/admin
 * @access Private (admin)
 */
exports.getAdminTenants = asyncHandler(async (req, res) => {
  const tenants = await Tenant.find()
    .select('name slug plan subscriptionStatus status revenueModel markupPercentage commissionPercentage platformMarkupPercentage packMarkupPercentage packCommissionPercentage packRateMinUnits logo primaryColor contactEmail contactPhone country isSystemTenant admin kycVerified createdAt')
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
  // `-bvn`: the raw BVN is KYC input, never something the admin UI needs back
  const tenant = await Tenant.findById(req.params.id)
    .select('-bvn')
    .populate('admin', 'firstName lastName displayName email phone role status')
    .populate('approvedBy', 'firstName lastName displayName email')
    .lean();
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
  const ownerEmail = (req.body.ownerEmail || '').trim().toLowerCase();

  // Validate the owner up front — creating the tenant first and failing here
  // would leave an orphaned tenant behind.
  if (ownerEmail) {
    const existingUser = await User.findOne({ email: ownerEmail }).lean();
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: `A user with the email ${ownerEmail} already exists. Assign that account as owner instead.`,
      });
    }
  }

  if (tenantData.slug) {
    const slugTaken = await Tenant.findOne({ slug: tenantData.slug }).select('_id').lean();
    if (slugTaken) {
      return res.status(409).json({
        success: false,
        message: `The slug "${tenantData.slug}" is already taken. Choose a different one.`,
      });
    }
  }

  if (req.files?.logo?.[0]) {
    tenantData.logo = await uploadTenantFile(req.files.logo[0], req.body.name || 'Tenant logo');
  }

  // Approving straight from the create form still has to stamp the approval
  if (tenantData.status === 'approved') {
    tenantData.approvedAt = new Date();
    tenantData.approvedBy = req.user?._id;
    tenantData.onboardedAt = new Date();
  }

  const tenant = new Tenant(tenantData);

  try {
    await tenant.save();
  } catch (err) {
    if (isDuplicateSlugError(err)) {
      return res.status(409).json({
        success: false,
        message: `The slug "${tenantData.slug}" is already taken. Choose a different one.`,
      });
    }
    throw err;
  }

  // ── Optional owner account ──────────────────────────────────────────────────
  // Without one, nobody can sign in to the tenant that was just created.
  let ownerInvite = null;
  if (ownerEmail) {
    const owner = await provisionTenantOwner({
      tenant,
      email: ownerEmail,
      name: req.body.ownerName,
      phone: req.body.ownerPhone,
    });
    tenant.admin = owner.user._id;
    await tenant.save();
    ownerInvite = { email: owner.user.email, emailSent: owner.emailSent };
  }

  // Audit: platform admin created a tenant
  logPrivilegedAction(req, 'TENANT_CREATE', 'create', {
    targetType: 'Tenant',
    targetId: tenant._id,
    targetTenantId: tenant._id,
  });

  res.status(201).json({ success: true, data: { tenant, ownerInvite } });
});

/**
 * Create the tenant_owner User for a tenant and email them a set-password link.
 *
 * The account is created with an unguessable random password; the invite is a
 * standard password-reset token, so the owner sets their own password on first
 * use. A failed email is reported back rather than thrown — the account exists
 * either way and the admin can re-send.
 */
async function provisionTenantOwner({ tenant, email, name, phone }) {
  const tempPassword = crypto.randomBytes(32).toString('hex');
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const [firstName, ...lastNameParts] = String(name || '').trim().split(/\s+/);
  const lastName = lastNameParts.join(' ');

  const user = await User.create({
    email,
    passwordHash,
    firstName: firstName || 'Owner',
    lastName,
    displayName: name?.trim() || tenant.name,
    phone: phone || tenant.contactPhone || undefined,
    role: 'tenant_owner',
    tenant: tenant._id,
    status: 'active',
    isEmailVerified: false,
  });

  const resetToken = user.generatePasswordResetToken();
  await user.save();

  let emailSent = false;
  try {
    await emailService.sendPasswordResetEmail({
      email: user.email,
      firstName: user.firstName,
      resetToken,
    });
    emailSent = true;
  } catch (err) {
    console.error('[Tenant] Failed to send owner invite email:', err.message);
  }

  return { user, emailSent };
}

/**
 * @route PUT /api/tenants/admin/:id
 * @access Private (admin)
 */
exports.updateAdminTenant = asyncHandler(async (req, res) => {
  const before = await Tenant.findById(req.params.id).lean();
  if (!before) {
    return res.status(404).json({ success: false, message: 'Tenant not found' });
  }

  const updateData = buildTenantData(req.body, true);

  // A rejection the tenant owner can't act on is worse than no rejection
  if (updateData.status === 'rejected' && !(updateData.rejectionReason ?? before.rejectionReason)?.trim()) {
    return res.status(400).json({
      success: false,
      message: 'A rejection reason is required when rejecting a tenant.',
    });
  }

  if (updateData.slug && updateData.slug !== before.slug) {
    const slugTaken = await Tenant.findOne({ slug: updateData.slug, _id: { $ne: before._id } })
      .select('_id')
      .lean();
    if (slugTaken) {
      return res.status(409).json({
        success: false,
        message: `The slug "${updateData.slug}" is already taken. Choose a different one.`,
      });
    }
  }

  if (req.files?.logo?.[0]) {
    updateData.logo = await uploadTenantFile(req.files.logo[0], req.body.name || 'Tenant logo');
  }

  // Stamp the approval on the transition, not on every save of an approved tenant
  if (updateData.status === 'approved' && before.status !== 'approved') {
    updateData.approvedAt = new Date();
    updateData.approvedBy = req.user?._id;
    if (!before.onboardedAt) updateData.onboardedAt = new Date();
    // Venues trade from tables from day one; resellers opt in manually.
    if (
      isVenueBusinessType(updateData.businessType || before.businessType) &&
      updateData['posSettings.isBarRestaurant'] === undefined &&
      before.posSettings?.isBarRestaurant !== true
    ) {
      updateData['posSettings.isBarRestaurant'] = true;
    }
  }

  // Dot paths, so untouched keys inside address/purchaseSettings survive
  const flatUpdate = flattenForUpdate(updateData);

  let tenant;
  try {
    tenant = await Tenant.findByIdAndUpdate(
      req.params.id,
      { $set: flatUpdate },
      { new: true, runValidators: true }
    );
  } catch (err) {
    if (isDuplicateSlugError(err)) {
      return res.status(409).json({
        success: false,
        message: `The slug "${updateData.slug}" is already taken. Choose a different one.`,
      });
    }
    throw err;
  }

  if (!tenant) {
    return res.status(404).json({ success: false, message: 'Tenant not found' });
  }

  await regeocodeIfAddressChanged(tenant, flatUpdate, before);

  // Audit: platform admin updated a tenant
  logPrivilegedAction(req, 'TENANT_UPDATE', 'update', {
    targetType: 'Tenant',
    targetId: tenant._id,
    targetTenantId: tenant._id,
    changes: { before, after: tenant.toObject() },
  });

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

  // Audit BEFORE deletion (target won't exist after)
  logPrivilegedAction(req, 'TENANT_DELETE', 'delete', {
    targetType: 'Tenant',
    targetId: id,
    targetTenantId: id,
    changes: { before: tenant.toObject(), after: null },
  });

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

// ─── Public: Vendor Application ─────────────────────────────────────────────────

const jwt = require('jsonwebtoken');
const { generateUniqueSlug } = require('../utils/slugify');
const { logAudit } = require('../utils/auditLog');
const kycService = require('../services/kyc.service');

/**
 * @route   POST /api/tenants/apply
 * @access  Public (rate-limited)
 * @desc    Self-service vendor application — creates a pending Tenant + tenant_owner User.
 *          Does NOT auto-login. Admin must approve before the tenant goes live.
 */
exports.applyTenant = asyncHandler(async (req, res) => {
  const b = req.body;

  // ── 0. Conditional NAFDAC validation ──────────────────────────────────────
  if (b.nafdacRequired === true && !b.nafdacNumber?.trim()) {
    return res.status(400).json({
      success: false,
      message: 'NAFDAC registration number is required when you sell regulated beverages',
      errors: { nafdacNumber: 'NAFDAC registration number is required' },
    });
  }

  // ── 1. Validate email uniqueness ──────────────────────────────────────────
  const existingUser = await User.findOne({ email: b.email.toLowerCase() });
  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: 'An account with this email already exists. Please log in instead.',
    });
  }

  // ── 2. Validate slug uniqueness (or generate a unique one) ─────────────────
  let slug = (b.slug || '').trim().toLowerCase();
  if (!slug) {
    return res.status(400).json({ success: false, message: 'Store URL slug is required' });
  }
  slug = await generateUniqueSlug(slug, async (testSlug) =>
    await Tenant.findOne({ slug: testSlug }).lean()
  );

  // ── 3. Validate plan ───────────────────────────────────────────────────────
  const validPlans = ['free_trial', 'starter', 'growth', 'pro', 'enterprise', 'venue'];
  const plan = validPlans.includes(b.plan) ? b.plan : 'free_trial';

  // ── 4. Create Tenant (status: pending) ─────────────────────────────────────
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14); // 14-day trial

  const tenant = new Tenant({
    name: b.businessName,
    slug,
    plan,
    status: 'pending',
    subscriptionStatus: 'trialing',
    revenueModel: 'commission',
    commissionPercentage: 13,
    defaultCurrency: 'NGN',
    country: 'Nigeria',
    enforceAgeVerification: true,
    contactEmail: b.email.toLowerCase(),
    contactPhone: b.phone,
    businessType: b.businessType,
    cacNumber: b.cacNumber,
    tin: b.tin,
    bvn: b.bvn,
    idType: b.idType,
    idNumber: b.idNumber,
    bankName: b.bankName,
    bankAccountNumber: b.bankAccountNumber,
    bankAccountName: b.bankAccountName,
    nafdacNumber: b.nafdacNumber,
    nafdacRequired: b.nafdacRequired === true,
    applicationDescription: b.description,
    trialEndsAt,
    address: {
      formatted: b.addressFormatted,
      city: b.city,
      state: b.state,
      zipCode: b.postcode,
      country: 'Nigeria',
    },
    // Tenant.location is {lat, lon, ...}, not GeoJSON — a Point/coordinates
    // shape is silently dropped by strict mode, leaving applicants ungeocoded
    location: (b.addressLat && b.addressLon) ? {
      lat: Number(b.addressLat),
      lon: Number(b.addressLon),
      geocodedAt: new Date(),
      source: 'manual',
    } : undefined,
  });

  await tenant.save();

  // ── 5. Create User (role: tenant_owner) ────────────────────────────────────
  // Generate a random temporary password — user will set their own on first login
  const tempPassword = crypto.randomBytes(16).toString('hex');
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const [firstName, ...lastNameParts] = (b.contactName || '').trim().split(/\s+/);
  const lastName = lastNameParts.join(' ') || '';

  const user = await User.create({
    email: b.email.toLowerCase(),
    passwordHash,
    firstName: firstName || 'Vendor',
    lastName,
    displayName: b.contactName || b.businessName,
    phone: b.phone,
    role: 'tenant_owner',
    tenant: tenant._id,
    status: 'active',
    isEmailVerified: false,
    isAgeVerified: b.ageConfirmed === true,
  });

  // ── 6. Link user as tenant admin ────────────────────────────────────────────
  tenant.admin = user._id;
  await tenant.save();

  // ── 7. External KYC verification (Paystack APIs) ──────────────────────────
  // Verifies BVN and bank account belong to this person/business.
  // Failures are stored as warnings — admin makes the final approval decision.
  let kycResult = { verified: false, checks: [], warnings: [], errors: [] };
  try {
    kycResult = await kycService.verifyVendorKYC({
      bvn: b.bvn,
      bankAccountNumber: b.bankAccountNumber,
      bankName: b.bankName,
      bankAccountName: b.bankAccountName,
      contactName: b.contactName,
      cacNumber: b.cacNumber,
      businessName: b.businessName,
      tin: b.tin,
      idType: b.idType,
      idNumber: b.idNumber,
    });

    // Persist KYC results on the tenant for admin review
    tenant.kycVerified = kycResult.verified;
    tenant.kycChecks = kycResult.checks;
    tenant.kycWarnings = kycResult.warnings;
    tenant.kycNameCrossCheck = kycResult.nameCrossCheck;
    await tenant.save();
  } catch (err) {
    console.error('KYC verification error (non-blocking):', err.message);
    // Don't fail the application if KYC service is down — admin can verify manually
  }

  // ── 8. Audit log ────────────────────────────────────────────────────────────
  await logAudit({
    action: 'TENANT_APPLY',
    actionCategory: 'create',
    actorUserId: user._id,
    actorRole: 'tenant_owner',
    actorEmail: user.email,
    targetType: 'Tenant',
    targetId: tenant._id,
    targetTenantId: tenant._id,
    req,
    result: 'success',
    changes: { tenantName: tenant.name, slug: tenant.slug, plan: tenant.plan },
    fireAndForget: true,
  });

  // ── 8. Send emails (non-blocking) ──────────────────────────────────────────
  try {
    await emailService.sendTenantApplicationReceivedEmail({
      email: user.email,
      firstName: user.firstName,
      businessName: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
    });
  } catch (err) {
    console.error('Failed to send application confirmation email:', err.message);
  }

  try {
    await emailService.sendTenantApplicationNotificationToAdmin({
      businessName: tenant.name,
      slug: tenant.slug,
      contactName: b.contactName,
      email: user.email,
      phone: b.phone,
      businessType: b.businessType,
      plan: tenant.plan,
      city: b.city,
      state: b.state,
      kycVerified: kycResult.verified,
      kycChecks: kycResult.checks,
      kycWarnings: kycResult.warnings,
      kycNameCrossCheck: kycResult.nameCrossCheck,
    });
  } catch (err) {
    console.error('Failed to send admin notification email:', err.message);
  }

  // ── 10. Respond ──────────────────────────────────────────────────────────────
  res.status(201).json({
    success: true,
    message: 'Application received! We will review it within 48 hours and email you with next steps.',
    data: {
      applicationId: tenant._id,
      slug: tenant.slug,
      status: tenant.status,
      plan: tenant.plan,
      kyc: {
        verified: kycResult.verified,
        checks: kycResult.checks,
        warnings: kycResult.warnings,
        errors: kycResult.errors,
      },
    },
  });
});

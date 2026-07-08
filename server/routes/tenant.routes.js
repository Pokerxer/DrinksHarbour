// routes/tenant.routes.js

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const { protect, authorize, superAdminOnly } = require('../middleware/auth.middleware');
const { uploadBrandImages } = require('../middleware/imageUpload.middleware');
const { validate } = require('../middleware/validation.middleware');
const tenantController = require('../controllers/tenant.controller');

const adminRoles = ['admin', 'super_admin'];

// ── Rate limiter for public applications ──────────────────────────────────────
const applyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,                   // 5 applications per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, forwardedHeader: false },
  message: { success: false, message: 'Too many applications from this IP. Please try again later.' },
});

// ── Validation rules for vendor application ────────────────────────────────────
const applyValidation = [
  // Business
  body('businessName').trim().notEmpty().withMessage('Business name is required')
    .isLength({ max: 100 }).withMessage('Business name is too long'),
  body('slug').trim().notEmpty().withMessage('Store URL slug is required')
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).withMessage('Slug can only contain lowercase letters, numbers, and hyphens'),
  body('businessType').trim().notEmpty().withMessage('Business type is required')
    .isIn(['Wine Merchant', 'Spirit Importer', 'Beverage Brand', 'Liquor Store',
      'Bar / Lounge', 'Restaurant', 'Hotel', 'Distributor', 'Other'])
    .withMessage('Invalid business type'),

  // Address
  body('addressFormatted').trim().notEmpty().withMessage('Business address is required'),
  body('addressLat').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude is required'),
  body('addressLon').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude is required'),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('state').trim().notEmpty().withMessage('State is required'),
  body('postcode').optional().trim(),

  // Contact
  body('contactName').trim().notEmpty().withMessage('Contact name is required')
    .isLength({ min: 2, max: 80 }).withMessage('Contact name must be 2-80 characters'),
  body('contactRole').trim().notEmpty().withMessage('Contact role is required')
    .isIn(['Owner', 'Director', 'Manager', 'Partner', 'Staff']).withMessage('Invalid contact role'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('phone').trim().notEmpty().withMessage('Phone number is required')
    .matches(/^(\+?234|0)[7-9][01]\d{8}$/).withMessage('Enter a valid Nigerian phone number (e.g. +234 801 234 5678 or 08012345678)'),

  // Legal — Business Registration
  body('cacNumber').trim().notEmpty().withMessage('CAC registration number is required')
    .matches(/^(RC|BN|IT)\d{5,8}$/i).withMessage('CAC number must be in format RC1234567 or BN1234567'),
  body('tin').trim().notEmpty().withMessage('Tax ID (TIN) is required')
    .matches(/^\d{10}[-\d]*$/).withMessage('TIN must be 10-14 digits (hyphens allowed)'),

  // Legal — KYC
  body('bvn').trim().notEmpty().withMessage('BVN is required')
    .isLength({ min: 11, max: 11 }).withMessage('BVN must be exactly 11 digits')
    .isNumeric().withMessage('BVN must contain only digits'),
  body('idType').trim().notEmpty().withMessage('ID type is required')
    .isIn(['NIN (National ID)', "Driver's License", 'International Passport', "Voter's Card"])
    .withMessage('Invalid ID type'),
  body('idNumber').trim().notEmpty().withMessage('ID number is required')
    .isLength({ min: 5, max: 30 }).withMessage('ID number must be 5-30 characters')
    .matches(/^[A-Za-z0-9\-]+$/).withMessage('ID number can only contain letters, numbers, and hyphens'),

  // Legal — Bank
  body('bankName').trim().notEmpty().withMessage('Bank name is required')
    .isLength({ max: 80 }).withMessage('Bank name is too long'),
  body('bankAccountNumber').trim().notEmpty().withMessage('Account number is required')
    .isLength({ min: 10, max: 10 }).withMessage('Account number must be exactly 10 digits')
    .isNumeric().withMessage('Account number must contain only digits'),
  body('bankAccountName').trim().notEmpty().withMessage('Account name is required')
    .isLength({ min: 3, max: 100 }).withMessage('Account name must be 3-100 characters'),

  // Legal — NAFDAC (conditional)
  body('nafdacRequired').optional().isBoolean(),
  body('nafdacNumber').optional().trim()
    .matches(/^[A-Za-z0-9\-\/]+$/).withMessage('NAFDAC number can only contain letters, numbers, hyphens, and slashes'),

  // Legal — Agreements (must be true)
  body('ageConfirmed').isBoolean().withMessage('Age confirmation is required')
    .custom((v) => v === true).withMessage('You must confirm the owner is 21 or older'),
  body('termsAccepted').isBoolean().withMessage('Terms acceptance is required')
    .custom((v) => v === true).withMessage('You must accept the Terms and Vendor Agreement'),
  body('dataConsent').isBoolean().withMessage('Data consent is required')
    .custom((v) => v === true).withMessage('You must consent to data processing'),

  // Legal — Documents
  body('cacDoc').optional().trim(),

  // Plan
  body('plan').optional().isIn(['free_trial', 'starter', 'growth', 'pro', 'enterprise', 'venue']),
];

// ── Public routes (BEFORE admin/wildcard routes) ──────────────────────────────
router.get('/slug/:slug', tenantController.getTenantBySlug);
router.post('/apply', applyLimiter, applyValidation, validate, tenantController.applyTenant);

// ── Admin routes (BEFORE any /:id wildcards) ──────────────────────────────────
router.get('/admin', protect, authorize(...adminRoles), tenantController.getAdminTenants);
router.get('/admin/:id', protect, authorize(...adminRoles), tenantController.getAdminTenantById);
router.post('/admin', protect, authorize(...adminRoles), uploadBrandImages, tenantController.createAdminTenant);
router.put('/admin/:id', protect, authorize(...adminRoles), uploadBrandImages, tenantController.updateAdminTenant);
// Tenant deletion — super_admin only (most destructive operation)
router.delete('/admin/:id', protect, authorize('super_admin'), superAdminOnly, tenantController.deleteAdminTenant);

module.exports = router;

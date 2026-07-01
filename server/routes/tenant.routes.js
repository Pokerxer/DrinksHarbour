// routes/tenant.routes.js

const express = require('express');
const router = express.Router();
const { protect, authorize, superAdminOnly } = require('../middleware/auth.middleware');
const { uploadBrandImages } = require('../middleware/imageUpload.middleware');
const tenantController = require('../controllers/tenant.controller');

const adminRoles = ['admin', 'super_admin'];

// Public routes (BEFORE admin/wildcard routes)
router.get('/slug/:slug', tenantController.getTenantBySlug);

// Admin routes (BEFORE any /:id wildcards)
router.get('/admin', protect, authorize(...adminRoles), tenantController.getAdminTenants);
router.get('/admin/:id', protect, authorize(...adminRoles), tenantController.getAdminTenantById);
router.post('/admin', protect, authorize(...adminRoles), uploadBrandImages, tenantController.createAdminTenant);
router.put('/admin/:id', protect, authorize(...adminRoles), uploadBrandImages, tenantController.updateAdminTenant);
// Tenant deletion — super_admin only (most destructive operation)
router.delete('/admin/:id', protect, authorize('super_admin'), superAdminOnly, tenantController.deleteAdminTenant);

module.exports = router;

// routes/brand.routes.js

const express = require('express');
const router = express.Router();
const brandController = require('../controllers/brand.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { uploadBrandImages } = require('../middleware/imageUpload.middleware');

// Brand carries no `tenant` field — brands are platform-wide, shared by every
// tenant and the storefront, so only platform admins may write them. Tenants
// propose a brand through POST / instead, which yields a pending brand.
const adminRoles = ['super_admin', 'admin'];

// Admin CRUD routes (protected) — must come BEFORE /:id wildcard routes
router.post('/admin/ai-fill', protect, authorize(...adminRoles), brandController.fillWithAI);
router.get('/admin', protect, authorize(...adminRoles), brandController.getAdminBrands);
router.post('/admin', protect, authorize(...adminRoles), uploadBrandImages, brandController.createAdminBrand);
router.put('/admin/:id', protect, authorize(...adminRoles), uploadBrandImages, brandController.updateAdminBrand);
router.delete('/admin/:id', protect, authorize(...adminRoles), brandController.deleteAdminBrand);

// Public routes
router.get('/', brandController.getAllBrands);
router.get('/filters/options', brandController.getFilterOptions);
router.get('/featured', brandController.getFeaturedBrands);
router.get('/popular', brandController.getPopularBrands);
router.get('/stats/overview', brandController.getBrandStats);
router.get('/category/:category', brandController.getBrandsByCategory);
router.get('/slug/:slug', brandController.getBrandBySlug);
router.get('/:id', brandController.getBrandById);

// ── Guarded mutations on the bare /:id namespace ─────────────────────────────
// These five used to sit here with no guard at all, which made an anonymous
// DELETE /api/brands/:id a live production hole. PUT/PATCH/DELETE had no
// callers and duplicated the guarded /admin/:id routes above, so they are gone.
//
// POST / keeps a wider role set on purpose: it backs the inline "create brand"
// modal in the product and sub-product flows. Tenant roles get a *pending*
// brand — see brand.controller.createBrand.
router.post(
  '/',
  protect,
  authorize('super_admin', 'admin', 'tenant_owner', 'tenant_admin', 'tenant_staff'),
  brandController.createBrand
);
router.post(
  '/:id/recalculate',
  protect,
  authorize('super_admin', 'admin'),
  brandController.recalculateProductCount
);

module.exports = router;

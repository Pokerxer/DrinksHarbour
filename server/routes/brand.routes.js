// routes/brand.routes.js

const express = require('express');
const router = express.Router();
const brandController = require('../controllers/brand.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { uploadBrandImages } = require('../middleware/imageUpload.middleware');

const adminRoles = ['super_admin', 'admin', 'tenant_owner', 'tenant_admin'];

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

// Protected routes (existing)
router.post('/', brandController.createBrand);
router.put('/:id', brandController.updateBrand);
router.patch('/:id', brandController.patchBrand);
router.delete('/:id', brandController.deleteBrand);
router.post('/:id/recalculate', brandController.recalculateProductCount);

module.exports = router;

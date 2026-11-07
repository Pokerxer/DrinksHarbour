const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');
const { protect, optionalProtect, authorize } = require('../middleware/auth.middleware');
const { TENANT_ROLES } = require('../services/industryScope.service');
const { uploadCategoryImages } = require('../middleware/imageUpload.middleware');

// Category is platform-wide: its only tenant-ish field is tenantPresenceCount,
// a denormalised counter, not ownership. Platform admins only.
const adminRoles = ['super_admin', 'admin'];

// Admin CRUD (protected) - must come before /:id routes
router.post('/admin/ai-fill', protect, authorize(...adminRoles), categoryController.fillWithAI);
router.post('/admin/ai/generate-category', protect, authorize(...adminRoles), categoryController.generateCategory);
router.get('/admin', protect, authorize(...adminRoles), categoryController.getAdminCategories);
router.post('/admin', protect, authorize(...adminRoles), uploadCategoryImages, categoryController.createCategory);
router.put('/admin/:id', protect, authorize(...adminRoles), uploadCategoryImages, categoryController.updateCategory);
router.delete('/admin/:id', protect, authorize(...adminRoles), categoryController.deleteCategory);

router.get('/picker', protect, authorize(...adminRoles, ...TENANT_ROLES), categoryController.getCategoryPicker);

// Public routes (optionalProtect: lets INDUSTRY_TAXONOMY_SCOPE_ENABLED scope
// GET / for authenticated tenant callers; anonymous browsing stays public)
router.get('/', optionalProtect, categoryController.getCategories);

router.get('/featured', categoryController.getFeaturedCategories);

router.get('/slug/:slug', categoryController.getCategoryBySlug);

router.get('/:id', categoryController.getCategoryById);

module.exports = router;

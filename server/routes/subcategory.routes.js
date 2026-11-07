const express = require('express');
const router = express.Router();
const subcategoryController = require('../controllers/subcategory.controller');
const { protect, optionalProtect, authorize } = require('../middleware/auth.middleware');
const { TENANT_ROLES } = require('../services/industryScope.service');
const { uploadCategoryImages } = require('../middleware/imageUpload.middleware');

// SubCategory is platform-wide for the same reason as Category —
// tenantPresenceCount is a counter, not ownership. Platform admins only.
const adminRoles = ['super_admin', 'admin'];

// Admin CRUD (protected) - must come before /:id routes
router.post('/admin/ai-fill', protect, authorize(...adminRoles), subcategoryController.fillWithAI);
router.post('/admin/ai/generate-subcategory', protect, authorize(...adminRoles), subcategoryController.generateSubCategory);
router.get('/admin', protect, authorize(...adminRoles), subcategoryController.getAdminSubCategories);
router.post('/admin', protect, authorize(...adminRoles), uploadCategoryImages, subcategoryController.createSubCategory);
router.put('/admin/:id', protect, authorize(...adminRoles), uploadCategoryImages, subcategoryController.updateSubCategory);
router.delete('/admin/:id', protect, authorize(...adminRoles), subcategoryController.deleteSubCategory);

router.get('/picker', protect, authorize(...adminRoles, ...TENANT_ROLES), subcategoryController.getSubCategoryPicker);

// Public routes (optionalProtect: lets INDUSTRY_TAXONOMY_SCOPE_ENABLED scope
// the list + the form's by-category chain for authenticated tenant callers;
// anonymous browsing stays public)
router.get('/', optionalProtect, subcategoryController.getSubCategories);

router.get('/by-category/:categoryId', optionalProtect, subcategoryController.getSubCategoriesByCategory);

router.get('/featured', subcategoryController.getFeaturedSubCategories);

router.get('/slug/:slug', subcategoryController.getSubCategoryBySlug);

router.get('/:id', subcategoryController.getSubCategoryById);

module.exports = router;

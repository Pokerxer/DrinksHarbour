const express = require('express');
const router = express.Router();
const subcategoryController = require('../controllers/subcategory.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { uploadCategoryImages } = require('../middleware/imageUpload.middleware');

const adminRoles = ['super_admin', 'admin', 'tenant_owner', 'tenant_admin'];

// Admin CRUD (protected) - must come before /:id routes
router.post('/admin/ai-fill', protect, authorize(...adminRoles), subcategoryController.fillWithAI);
router.get('/admin', protect, authorize(...adminRoles), subcategoryController.getAdminSubCategories);
router.post('/admin', protect, authorize(...adminRoles), uploadCategoryImages, subcategoryController.createSubCategory);
router.put('/admin/:id', protect, authorize(...adminRoles), uploadCategoryImages, subcategoryController.updateSubCategory);
router.delete('/admin/:id', protect, authorize(...adminRoles), subcategoryController.deleteSubCategory);

// Public routes
router.get('/', subcategoryController.getSubCategories);

router.get('/by-category/:categoryId', subcategoryController.getSubCategoriesByCategory);

router.get('/featured', subcategoryController.getFeaturedSubCategories);

router.get('/slug/:slug', subcategoryController.getSubCategoryBySlug);

router.get('/:id', subcategoryController.getSubCategoryById);

module.exports = router;

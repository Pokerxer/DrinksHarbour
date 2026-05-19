const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { uploadCategoryImages } = require('../middleware/imageUpload.middleware');

const adminRoles = ['super_admin', 'admin', 'tenant_owner', 'tenant_admin'];

// Admin CRUD (protected) - must come before /:id routes
router.post('/admin/ai-fill', protect, authorize(...adminRoles), categoryController.fillWithAI);
router.get('/admin', protect, authorize(...adminRoles), categoryController.getAdminCategories);
router.post('/admin', protect, authorize(...adminRoles), uploadCategoryImages, categoryController.createCategory);
router.put('/admin/:id', protect, authorize(...adminRoles), uploadCategoryImages, categoryController.updateCategory);
router.delete('/admin/:id', protect, authorize(...adminRoles), categoryController.deleteCategory);

// Public routes
router.get('/', categoryController.getCategories);

router.get('/featured', categoryController.getFeaturedCategories);

router.get('/slug/:slug', categoryController.getCategoryBySlug);

router.get('/:id', categoryController.getCategoryById);

module.exports = router;

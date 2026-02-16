const express = require('express');
const router = express.Router();
const subcategoryController = require('../controllers/subcategory.controller');

router.get('/', subcategoryController.getSubCategories);

router.get('/by-category/:categoryId', subcategoryController.getSubCategoriesByCategory);

router.get('/featured', subcategoryController.getFeaturedSubCategories);

router.get('/:id', subcategoryController.getSubCategoryById);

router.get('/slug/:slug', subcategoryController.getSubCategoryBySlug);

module.exports = router;

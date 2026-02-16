const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');

router.get('/', categoryController.getCategories);

router.get('/featured', categoryController.getFeaturedCategories);

router.get('/:id', categoryController.getCategoryById);

router.get('/slug/:slug', categoryController.getCategoryBySlug);

module.exports = router;

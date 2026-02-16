// routes/brand.routes.js

const express = require('express');
const router = express.Router();
const brandController = require('../controllers/brand.controller');

// Public routes
router.get('/', brandController.getAllBrands);
router.get('/filters/options', brandController.getFilterOptions);
router.get('/featured', brandController.getFeaturedBrands);
router.get('/popular', brandController.getPopularBrands);
router.get('/stats/overview', brandController.getBrandStats);
router.get('/category/:category', brandController.getBrandsByCategory);
router.get('/slug/:slug', brandController.getBrandBySlug);
router.get('/:id', brandController.getBrandById);

// Protected routes (admin only) - add auth middleware as needed
router.post('/', brandController.createBrand);
router.put('/:id', brandController.updateBrand);
router.patch('/:id', brandController.patchBrand);
router.delete('/:id', brandController.deleteBrand);
router.post('/:id/recalculate', brandController.recalculateProductCount);

module.exports = router;

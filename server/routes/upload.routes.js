// routes/upload.routes.js

const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/upload.controller');
const {
  uploadSingleImage,
  uploadMultipleImages,
  uploadProductImages,
  uploadProductGallery,
  uploadBrandLogo,
  uploadCategoryImage,
} = require('../middleware/imageUpload.middleware');
const { authenticate } = require('../middleware/auth.middleware');

// All upload routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/upload/image
 * @desc    Upload single image
 * @access  Private
 */
router.post('/image', uploadSingleImage, uploadController.uploadSingleImage);

/**
 * @route   POST /api/upload/images
 * @desc    Upload multiple images (up to 10)
 * @access  Private
 */
router.post('/images', uploadMultipleImages, uploadController.uploadMultipleImages);

/**
 * @route   POST /api/upload/product-images
 * @desc    Upload product images (strict validation, up to 10)
 * @access  Private
 */
router.post(
  '/product-images',
  uploadProductImages,
  uploadController.uploadMultipleImages
);

/**
 * @route   POST /api/upload/product-gallery
 * @desc    Upload product gallery images (up to 20)
 * @access  Private
 */
router.post(
  '/product-gallery',
  uploadProductGallery,
  uploadController.uploadProductGallery
);

/**
 * @route   POST /api/upload/brand-logo
 * @desc    Upload brand logo
 * @access  Private
 */
router.post('/brand-logo', uploadBrandLogo, uploadController.uploadBrandLogo);

/**
 * @route   POST /api/upload/category-image
 * @desc    Upload category image
 * @access  Private
 */
router.post(
  '/category-image',
  uploadCategoryImage,
  uploadController.uploadCategoryImage
);

/**
 * @route   DELETE /api/upload/image/:publicId
 * @desc    Delete single image from Cloudinary
 * @access  Private
 */
router.delete('/image/:publicId', uploadController.deleteImage);

/**
 * @route   POST /api/upload/images/delete
 * @desc    Delete multiple images from Cloudinary
 * @access  Private
 */
router.post('/images/delete', uploadController.deleteMultipleImages);

/**
 * @route   POST /api/upload/transform
 * @desc    Get transformed image URL
 * @access  Private
 */
router.post('/transform', uploadController.getTransformedImage);

module.exports = router;

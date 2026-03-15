// routes/upload.routes.js

const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/upload.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Lazy-load upload middleware to avoid serverless filesystem issues
let uploadMiddleware;
const getUploadMiddleware = () => {
  if (!uploadMiddleware) {
    uploadMiddleware = require('../middleware/imageUpload.middleware');
  }
  return uploadMiddleware;
};

// All upload routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/upload/image
 * @desc    Upload single image
 * @access  Private
 */
router.post('/image', (req, res, next) => getUploadMiddleware().uploadSingleImage(req, res, next), uploadController.uploadSingleImage);

/**
 * @route   POST /api/upload/images
 * @desc    Upload multiple images (up to 10)
 * @access  Private
 */
router.post('/images', (req, res, next) => getUploadMiddleware().uploadMultipleImages(req, res, next), uploadController.uploadMultipleImages);

/**
 * @route   POST /api/upload/product-images
 * @desc    Upload product images (strict validation, up to 10)
 * @access  Private
 */
router.post(
  '/product-images',
  (req, res, next) => getUploadMiddleware().uploadProductImages(req, res, next),
  uploadController.uploadMultipleImages
);

/**
 * @route   POST /api/upload/product-gallery
 * @desc    Upload product gallery images (up to 20)
 * @access  Private
 */
router.post(
  '/product-gallery',
  (req, res, next) => getUploadMiddleware().uploadProductGallery(req, res, next),
  uploadController.uploadProductGallery
);

/**
 * @route   POST /api/upload/brand-logo
 * @desc    Upload brand logo
 * @access  Private
 */
router.post('/brand-logo', (req, res, next) => getUploadMiddleware().uploadBrandLogo(req, res, next), uploadController.uploadBrandLogo);

/**
 * @route   POST /api/upload/category-image
 * @desc    Upload category image
 * @access  Private
 */
router.post(
  '/category-image',
  (req, res, next) => getUploadMiddleware().uploadCategoryImage(req, res, next),
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

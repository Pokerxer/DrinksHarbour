// controllers/upload.controller.js

const cloudinaryService = require('../services/cloudinary.service');
const { ValidationError } = require('../utils/errors');

/**
 * Upload single image
 * POST /api/upload/image
 */
const uploadSingleImage = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ValidationError('No image file provided');
    }

    const { folder = 'products', tags } = req.body;
    
    const result = await cloudinaryService.uploadImage(req.file.buffer, {
      folder,
      tags: tags ? tags.split(',') : [],
      context: {
        uploadedBy: req.user?._id?.toString(),
        originalName: req.file.originalname,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload multiple images
 * POST /api/upload/images
 */
const uploadMultipleImages = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      throw new ValidationError('No image files provided');
    }

    const { folder = 'products', tags } = req.body;
    
    const files = req.files.map((file, index) => ({
      buffer: file.buffer,
      originalname: file.originalname,
    }));
    
    const results = await cloudinaryService.uploadMultipleImages(files, {
      folder,
      tags: tags ? tags.split(',') : [],
      context: {
        uploadedBy: req.user?._id?.toString(),
      },
    });

    res.status(200).json({
      success: true,
      message: `${results.length} images uploaded successfully`,
      data: results,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload product gallery images
 * POST /api/upload/product-gallery
 */
const uploadProductGallery = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      throw new ValidationError('No image files provided');
    }

    const { productId, tags } = req.body;
    
    const files = req.files.map((file) => ({
      buffer: file.buffer,
      originalname: file.originalname,
    }));
    
    const results = await cloudinaryService.uploadMultipleImages(files, {
      folder: 'products/gallery',
      tags: ['product-gallery', ...(tags ? tags.split(',') : [])],
      context: {
        uploadedBy: req.user?._id?.toString(),
        productId: productId || 'temp',
      },
    });

    res.status(200).json({
      success: true,
      message: `${results.length} gallery images uploaded successfully`,
      data: results.map((result, index) => ({
        ...result,
        isPrimary: index === 0, // First image is primary by default
        order: index,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload brand logo
 * POST /api/upload/brand-logo
 */
const uploadBrandLogo = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ValidationError('No logo file provided');
    }

    const { brandId } = req.body;
    
    const result = await cloudinaryService.uploadImage(req.file.buffer, {
      folder: 'brands/logos',
      tags: ['brand-logo'],
      context: {
        uploadedBy: req.user?._id?.toString(),
        brandId: brandId || 'temp',
      },
    });

    res.status(200).json({
      success: true,
      message: 'Brand logo uploaded successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload category image
 * POST /api/upload/category-image
 */
const uploadCategoryImage = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ValidationError('No image file provided');
    }

    const { categoryId } = req.body;
    
    const result = await cloudinaryService.uploadImage(req.file.buffer, {
      folder: 'categories',
      tags: ['category-image'],
      context: {
        uploadedBy: req.user?._id?.toString(),
        categoryId: categoryId || 'temp',
      },
    });

    res.status(200).json({
      success: true,
      message: 'Category image uploaded successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete image from Cloudinary
 * DELETE /api/upload/image/:publicId
 */
const deleteImage = async (req, res, next) => {
  try {
    const { publicId } = req.params;
    
    if (!publicId) {
      throw new ValidationError('Public ID is required');
    }

    await cloudinaryService.deleteImage(publicId);

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete multiple images
 * POST /api/upload/images/delete
 */
const deleteMultipleImages = async (req, res, next) => {
  try {
    const { publicIds } = req.body;
    
    if (!Array.isArray(publicIds) || publicIds.length === 0) {
      throw new ValidationError('Array of public IDs is required');
    }

    const results = await cloudinaryService.deleteMultipleImages(publicIds);

    res.status(200).json({
      success: true,
      message: 'Images deleted successfully',
      data: results,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get transformed image URL
 * POST /api/upload/transform
 */
const getTransformedImage = async (req, res, next) => {
  try {
    const { publicId, transformations } = req.body;
    
    if (!publicId) {
      throw new ValidationError('Public ID is required');
    }

    const url = cloudinaryService.getTransformedUrl(publicId, transformations);

    res.status(200).json({
      success: true,
      data: { url },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadSingleImage,
  uploadMultipleImages,
  uploadProductGallery,
  uploadBrandLogo,
  uploadCategoryImage,
  deleteImage,
  deleteMultipleImages,
  getTransformedImage,
};

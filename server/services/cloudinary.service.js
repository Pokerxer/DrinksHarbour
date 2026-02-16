// services/cloudinary.service.js

const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const { ValidationError } = require('../utils/errors');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Upload image to Cloudinary
 * @param {Buffer} fileBuffer - Image buffer
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} Upload result
 */
const uploadImage = async (fileBuffer, options = {}) => {
  const {
    folder = 'products',
    resourceType = 'image',
    tags = [],
    context = {},
    transformation = {},
  } = options;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `drinksharbour/${folder}`,
        resource_type: resourceType,
        tags: ['drinksharbour', ...tags],
        context,
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
        max_file_size: 10485760, // 10MB
        ...transformation,
      },
      (error, result) => {
        if (error) {
          reject(new ValidationError(`Image upload failed: ${error.message}`));
        } else {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            resourceType: result.resource_type,
            format: result.format,
            width: result.width,
            height: result.height,
            size: result.bytes,
            thumbnail: cloudinary.url(result.public_id, {
              transformation: [
                { width: 200, height: 200, crop: 'fill' },
                { quality: 'auto', fetch_format: 'auto' },
              ],
            }),
          });
        }
      }
    );

    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
};

/**
 * Upload multiple images
 */
const uploadMultipleImages = async (files, options = {}) => {
  if (!Array.isArray(files) || files.length === 0) {
    throw new ValidationError('No files provided for upload');
  }

  if (files.length > 10) {
    throw new ValidationError('Maximum 10 images allowed per upload');
  }

  const uploadPromises = files.map((file, index) =>
    uploadImage(file.buffer, {
      ...options,
      tags: [...(options.tags || []), `batch-${Date.now()}`],
      context: {
        ...options.context,
        order: index,
      },
    })
  );

  return Promise.all(uploadPromises);
};

/**
 * Delete image from Cloudinary
 */
const deleteImage = async (publicId) => {
  if (!publicId) {
    throw new ValidationError('Public ID is required to delete image');
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId);
    
    if (result.result !== 'ok') {
      console.warn(`Failed to delete image ${publicId}:`, result);
    }
    
    return result;
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
    throw new ValidationError(`Failed to delete image: ${error.message}`);
  }
};

/**
 * Delete multiple images
 */
const deleteMultipleImages = async (publicIds) => {
  if (!Array.isArray(publicIds) || publicIds.length === 0) {
    return [];
  }

  const deletePromises = publicIds.map((publicId) =>
    deleteImage(publicId).catch((error) => {
      console.error(`Failed to delete ${publicId}:`, error);
      return { publicId, error: error.message };
    })
  );

  return Promise.all(deletePromises);
};

/**
 * Update image metadata
 */
const updateImageMetadata = async (publicId, metadata) => {
  try {
    const result = await cloudinary.uploader.explicit(publicId, {
      type: 'upload',
      context: metadata.context,
      tags: metadata.tags,
    });

    return result;
  } catch (error) {
    throw new ValidationError(`Failed to update image metadata: ${error.message}`);
  }
};

/**
 * Generate transformation URL
 */
const getTransformedUrl = (publicId, transformations) => {
  return cloudinary.url(publicId, {
    transformation: transformations,
    secure: true,
  });
};

/**
 * Get image details
 */
const getImageDetails = async (publicId) => {
  try {
    const result = await cloudinary.api.resource(publicId);
    return result;
  } catch (error) {
    throw new ValidationError(`Failed to get image details: ${error.message}`);
  }
};

module.exports = {
  cloudinary,
  uploadImage,
  uploadMultipleImages,
  deleteImage,
  deleteMultipleImages,
  updateImageMetadata,
  getTransformedUrl,
  getImageDetails,
};
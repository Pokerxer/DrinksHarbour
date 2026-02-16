// middleware/imageUpload.middleware.js

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { ValidationError } = require('../utils/errors');

// ============================================================
// CONFIGURATION
// ============================================================

// Allowed MIME types for images
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
];

// Maximum file sizes
const MAX_FILE_SIZE = {
  image: 10 * 1024 * 1024, // 10MB for images
  document: 5 * 1024 * 1024, // 5MB for documents
};

// Maximum number of files
const MAX_FILES = {
  single: 1,
  multiple: 10,
  gallery: 20,
};

// ============================================================
// ENSURE UPLOAD DIRECTORIES EXIST
// ============================================================

const ensureDirectoryExists = (dirPath) => {
  const absolutePath = path.resolve(__dirname, '..', dirPath);
  if (!fs.existsSync(absolutePath)) {
    fs.mkdirSync(absolutePath, { recursive: true });
  }
};

// Create all upload directories on module load
['uploads/temp', 'uploads/products', 'uploads/brands', 'uploads/categories', 'uploads/reviews', 'uploads/avatars'].forEach(dir => {
  ensureDirectoryExists(dir);
});

// ============================================================
// MEMORY STORAGE (for Cloudinary)
// ============================================================

const memoryStorage = multer.memoryStorage();

// ============================================================
// DISK STORAGE (for local development/testing)
// ============================================================

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Determine upload directory based on file type
    let uploadDir = 'uploads/temp';

    if (file.fieldname === 'productImages') {
      uploadDir = 'uploads/products';
    } else if (file.fieldname === 'brandLogo') {
      uploadDir = 'uploads/brands';
    } else if (file.fieldname === 'categoryImage') {
      uploadDir = 'uploads/categories';
    } else if (file.fieldname === 'reviewImages') {
      uploadDir = 'uploads/reviews';
    } else if (file.fieldname === 'avatar') {
      uploadDir = 'uploads/avatars';
    }

    // Ensure directory exists
    ensureDirectoryExists(uploadDir);
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext)
      .replace(/[^a-z0-9]/gi, '-')
      .toLowerCase();
    
    cb(null, `${basename}-${uniqueSuffix}${ext}`);
  },
});

// Use memory storage for production (Cloudinary), disk for development
const storage = process.env.NODE_ENV === 'production' ? memoryStorage : diskStorage;

// ============================================================
// FILE FILTERS
// ============================================================

/**
 * Filter for image files only
 */
const imageFileFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new ValidationError(
        `Invalid file type. Only ${ALLOWED_IMAGE_TYPES.join(', ')} are allowed.`
      ),
      false
    );
  }
};

/**
 * Filter for images with size validation
 */
const strictImageFilter = (req, file, cb) => {
  // Check MIME type
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    return cb(
      new ValidationError(
        'Invalid file type. Only JPEG, PNG, WebP, GIF, and SVG images are allowed.'
      ),
      false
    );
  }

  // Check file extension
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'];
  
  if (!allowedExtensions.includes(ext)) {
    return cb(
      new ValidationError(
        'Invalid file extension. Only .jpg, .jpeg, .png, .webp, .gif, .svg are allowed.'
      ),
      false
    );
  }

  cb(null, true);
};

/**
 * Filter for product images with stricter validation
 */
const productImageFilter = (req, file, cb) => {
  // Product images shouldn't be SVG for consistency
  const productAllowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ];

  if (!productAllowedTypes.includes(file.mimetype)) {
    return cb(
      new ValidationError(
        'Invalid file type for product images. Only JPEG, PNG, and WebP are allowed.'
      ),
      false
    );
  }

  cb(null, true);
};

// ============================================================
// MULTER INSTANCES
// ============================================================

/**
 * Basic image upload (single)
 */
const uploadSingleImage = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE.image,
    files: MAX_FILES.single,
  },
}).single('image');

/**
 * Multiple images upload (up to 10)
 */
const uploadMultipleImages = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE.image,
    files: MAX_FILES.multiple,
  },
}).array('images', MAX_FILES.multiple);

/**
 * Product images upload (strict validation)
 */
const uploadProductImages = multer({
  storage,
  fileFilter: productImageFilter,
  limits: {
    fileSize: MAX_FILE_SIZE.image,
    files: MAX_FILES.multiple,
  },
}).array('images', MAX_FILES.multiple);

/**
 * Product gallery upload (up to 20 images)
 */
const uploadProductGallery = multer({
  storage,
  fileFilter: productImageFilter,
  limits: {
    fileSize: MAX_FILE_SIZE.image,
    files: MAX_FILES.gallery,
  },
}).array('images', MAX_FILES.gallery);

/**
 * Brand logo upload
 */
const uploadBrandLogo = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE.image,
    files: 1,
  },
}).single('logo');

/**
 * Category/SubCategory image upload
 */
const uploadCategoryImage = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE.image,
    files: 1,
  },
}).single('image');

/**
 * Review images upload (up to 5)
 */
const uploadReviewImages = multer({
  storage,
  fileFilter: strictImageFilter,
  limits: {
    fileSize: MAX_FILE_SIZE.image,
    files: 5,
  },
}).array('images', 5);

/**
 * User avatar upload
 */
const uploadAvatar = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB for avatars
    files: 1,
  },
}).single('avatar');

/**
 * Multiple field uploads (mixed)
 */
const uploadMixedFields = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE.image,
    files: MAX_FILES.multiple,
  },
}).fields([
  { name: 'featuredImage', maxCount: 1 },
  { name: 'bannerImage', maxCount: 1 },
  { name: 'gallery', maxCount: 10 },
]);

// ============================================================
// MIDDLEWARE WRAPPERS (with better error handling)
// ============================================================

/**
 * Wrap multer middleware with custom error handling
 */
const wrapMulterMiddleware = (multerMiddleware) => {
  return (req, res, next) => {
    multerMiddleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        // Multer-specific errors
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(
            new ValidationError(
              `File too large. Maximum size is ${MAX_FILE_SIZE.image / (1024 * 1024)}MB`
            )
          );
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return next(
            new ValidationError(
              `Too many files. Maximum is ${err.limit} files`
            )
          );
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return next(
            new ValidationError(
              `Unexpected field: ${err.field}`
            )
          );
        }
        return next(new ValidationError(err.message));
      } else if (err) {
        // Other errors (including ValidationError from fileFilter)
        return next(err);
      }
      next();
    });
  };
};

// ============================================================
// VALIDATION MIDDLEWARE
// ============================================================

/**
 * Validate that at least one file was uploaded
 */
const requireFile = (req, res, next) => {
  if (!req.file && (!req.files || req.files.length === 0)) {
    return next(new ValidationError('At least one file is required'));
  }
  next();
};

/**
 * Validate file count
 */
const validateFileCount = (min, max) => {
  return (req, res, next) => {
    const fileCount = req.files ? req.files.length : (req.file ? 1 : 0);
    
    if (fileCount < min) {
      return next(
        new ValidationError(`At least ${min} file(s) required`)
      );
    }
    
    if (max && fileCount > max) {
      return next(
        new ValidationError(`Maximum ${max} file(s) allowed`)
      );
    }
    
    next();
  };
};

/**
 * Validate image dimensions (requires sharp or image-size package)
 */
const validateImageDimensions = (minWidth, minHeight, maxWidth, maxHeight) => {
  return async (req, res, next) => {
    try {
      if (!req.file && (!req.files || req.files.length === 0)) {
        return next();
      }

      const sharp = require('sharp');
      const files = req.files || [req.file];

      for (const file of files) {
        if (!file.buffer) continue; // Skip if not using memory storage

        const metadata = await sharp(file.buffer).metadata();

        if (minWidth && metadata.width < minWidth) {
          return next(
            new ValidationError(
              `Image width must be at least ${minWidth}px`
            )
          );
        }

        if (minHeight && metadata.height < minHeight) {
          return next(
            new ValidationError(
              `Image height must be at least ${minHeight}px`
            )
          );
        }

        if (maxWidth && metadata.width > maxWidth) {
          return next(
            new ValidationError(
              `Image width must not exceed ${maxWidth}px`
            )
          );
        }

        if (maxHeight && metadata.height > maxHeight) {
          return next(
            new ValidationError(
              `Image height must not exceed ${maxHeight}px`
            )
          );
        }
      }

      next();
    } catch (error) {
      next(new ValidationError('Invalid image file'));
    }
  };
};

/**
 * Validate aspect ratio
 */
const validateAspectRatio = (expectedRatio, tolerance = 0.1) => {
  return async (req, res, next) => {
    try {
      if (!req.file && (!req.files || req.files.length === 0)) {
        return next();
      }

      const sharp = require('sharp');
      const files = req.files || [req.file];

      for (const file of files) {
        if (!file.buffer) continue;

        const metadata = await sharp(file.buffer).metadata();
        const actualRatio = metadata.width / metadata.height;
        
        if (Math.abs(actualRatio - expectedRatio) > tolerance) {
          return next(
            new ValidationError(
              `Image aspect ratio should be ${expectedRatio}:1 (${metadata.width}x${metadata.height} is ${actualRatio.toFixed(2)}:1)`
            )
          );
        }
      }

      next();
    } catch (error) {
      next(new ValidationError('Invalid image file'));
    }
  };
};

/**
 * Add file metadata to request
 */
const addFileMetadata = (req, res, next) => {
  if (req.file) {
    req.file.uploadedAt = new Date();
    req.file.uploadedBy = req.user?._id;
  }

  if (req.files && Array.isArray(req.files)) {
    req.files = req.files.map((file) => ({
      ...file,
      uploadedAt: new Date(),
      uploadedBy: req.user?._id,
    }));
  }

  next();
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  // Basic uploads
  uploadSingleImage: wrapMulterMiddleware(uploadSingleImage),
  uploadMultipleImages: wrapMulterMiddleware(uploadMultipleImages),
  
  // Specialized uploads
  uploadProductImages: wrapMulterMiddleware(uploadProductImages),
  uploadProductGallery: wrapMulterMiddleware(uploadProductGallery),
  uploadBrandLogo: wrapMulterMiddleware(uploadBrandLogo),
  uploadCategoryImage: wrapMulterMiddleware(uploadCategoryImage),
  uploadReviewImages: wrapMulterMiddleware(uploadReviewImages),
  uploadAvatar: wrapMulterMiddleware(uploadAvatar),
  uploadMixedFields: wrapMulterMiddleware(uploadMixedFields),
  
  // Validation middleware
  requireFile,
  validateFileCount,
  validateImageDimensions,
  validateAspectRatio,
  addFileMetadata,
  
  // Constants
  ALLOWED_IMAGE_TYPES,
  MAX_FILE_SIZE,
  MAX_FILES,
};
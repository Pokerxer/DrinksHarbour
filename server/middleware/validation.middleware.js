// middleware/validation.middleware.js

const { body, param, query, validationResult } = require('express-validator');
const { ValidationError } = require('../utils/errors');

/**
 * Generic validation middleware
 * Use with express-validator rules (body, query, param)
 * @param {Array} validations - Express-validator chain array
 * @returns {Function} Middleware function
 */
function validate(reqOrValidations, res, next) {
  // If called as middleware (without validation array), just skip validation
  // This prevents issues when validate is called without validation chains
  if (!Array.isArray(reqOrValidations)) {
    return next();
  }

  // Scenario 1: Factory mode - validate([...])
  return async (req, res, next) => {
    try {
      await Promise.all(reqOrValidations.map(validation => validation.run(req)));

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const messages = errors.array().map(err => err.msg).join(', ');
        return next(new ValidationError(messages));
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

// ============================================================
// PRODUCT VALIDATIONS
// ============================================================

/**
 * Validate product creation
 */
const validateProductCreation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Product name is required')
    .isLength({ min: 2, max: 200 }).withMessage('Product name must be between 2 and 200 characters'),

  body('type')
    .notEmpty().withMessage('Product type is required')
    .isIn([
      'beer', 'wine', 'sparkling_wine', 'fortified_wine', 'spirit',
      'liqueur', 'cocktail_ready_to_drink', 'non_alcoholic', 'other',
      'juice', 'tea', 'coffee', 'energy_drink', 'water', 'mixer',
      'soda', 'cider', 'sake', 'mead', 'kombucha',
      'accessory', 'snack', 'gift'
    ]).withMessage('Invalid product type'),

  body('slug')
    .optional()
    .trim()
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .withMessage('Slug must be lowercase alphanumeric with hyphens'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Description cannot exceed 5000 characters'),

  body('isAlcoholic')
    .optional()
    .isBoolean().withMessage('isAlcoholic must be a boolean'),

  body('abv')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('ABV must be between 0 and 100'),

  body('volumeMl')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Volume must be a positive integer'),

  body('category')
    .optional()
    .isMongoId()
    .withMessage('Invalid category ID'),

  body('brand')
    .optional()
    .isMongoId()
    .withMessage('Invalid brand ID'),

  body('images')
    .optional()
    .isArray().withMessage('Images must be an array'),

  body('images.*.url')
    .optional()
    .isURL().withMessage('Image URL must be valid'),

  body('images.*.alt')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Image alt text cannot exceed 200 characters'),

  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),

  body('tags.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be between 1 and 50 characters'),

  // Tenant SubProduct validations (conditional)
  body('subProductData')
    .optional()
    .isObject()
    .withMessage('subProductData must be an object'),

  body('subProductData.baseSellingPrice')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('baseSellingPrice must be greater than 0'),

  body('subProductData.costPrice')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('costPrice must be greater than 0'),

  body('subProductData.currency')
    .optional()
    .isIn(['NGN', 'USD', 'EUR', 'GBP', 'ZAR'])
    .withMessage('Invalid currency'),
];

/**
 * Validate product update
 */
const validateProductUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Name must be between 2 and 200 characters'),

  body('slug')
    .optional()
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .withMessage('Slug must be lowercase alphanumeric with hyphens'),

  body('type')
    .optional()
    .isIn([
      'beer', 'wine', 'sparkling_wine', 'fortified_wine', 'spirit',
      'liqueur', 'cocktail_ready_to_drink', 'non_alcoholic', 'other',
      'juice', 'tea', 'coffee', 'energy_drink', 'water', 'mixer',
      'soda', 'cider', 'sake', 'mead', 'kombucha',
      'accessory', 'snack', 'gift',
    ])
    .withMessage('Invalid product type'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Description cannot exceed 5000 characters'),

  body('abv')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('ABV must be between 0 and 100'),

  body('volumeMl')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Volume must be a positive integer'),

  body('category')
    .optional()
    .isMongoId()
    .withMessage('Invalid category ID'),

  body('brand')
    .optional()
    .isMongoId()
    .withMessage('Invalid brand ID'),

  body('status')
    .optional()
    .isIn(['pending', 'approved', 'rejected', 'archived'])
    .withMessage('Invalid status'),
];

/**
 * Validate product import
 */
const validateProductImport = [
  (req, res, next) => {
    if (!req.file) {
      return next(new ValidationError('Import file is required'));
    }

    const allowedTypes = ['text/csv', 'application/json', 'application/vnd.ms-excel'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return next(new ValidationError('Only CSV and JSON files are allowed'));
    }

    // Check file size (10MB max)
    if (req.file.size > 10 * 1024 * 1024) {
      return next(new ValidationError('File size exceeds 10MB limit'));
    }

    next();
  },
];

/**
 * Validate MongoDB ID parameter
 */
const validateMongoId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format'),
];

/**
 * Validate product slug parameter
 */
const validateProductSlug = [
  param('slug')
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .withMessage('Invalid slug format'),
];

// ============================================================
// SUBPRODUCT VALIDATIONS
// ============================================================

/**
 * Validate SubProduct creation
 * Supports both linking to existing product (product/productId) and creating new product (createNewProduct)
 */
const validateSubProductCreation = [
  // Product ID is required UNLESS createNewProduct is true
  body('product')
    .optional()
    .custom((value, { req }) => {
      const createNewProduct = req.body.createNewProduct || req.body.subProductData?.createNewProduct;
      // If not creating a new product, product ID is required
      if (!createNewProduct && !value) {
        throw new Error('Product ID is required when not creating a new product');
      }
      // If value is provided and not empty, validate it's a valid MongoId
      if (value && value.trim() !== '') {
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(value)) {
          throw new Error('Invalid product ID format');
        }
      }
      return true;
    }),

  // Validate newProductData when createNewProduct is true
  body('createNewProduct')
    .optional()
    .isBoolean()
    .withMessage('createNewProduct must be a boolean'),

  body('newProductData.name')
    .optional()
    .custom((value, { req }) => {
      const createNewProduct = req.body.createNewProduct || req.body.subProductData?.createNewProduct;
      if (createNewProduct && (!value || value.trim() === '')) {
        throw new Error('Product name is required when creating a new product');
      }
      return true;
    }),

  body('newProductData.type')
    .optional()
    .custom((value, { req }) => {
      const createNewProduct = req.body.createNewProduct || req.body.subProductData?.createNewProduct;
      if (createNewProduct && (!value || value.trim() === '')) {
        throw new Error('Product type is required when creating a new product');
      }
      return true;
    }),

  body('baseSellingPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Base selling price must be 0 or greater'),

  body('costPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Cost price must be 0 or greater'),

  body('currency')
    .optional()
    .isIn(['NGN', 'USD', 'EUR', 'GBP', 'ZAR'])
    .withMessage('Invalid currency'),

  body('sizes')
    .optional()
    .isArray()
    .withMessage('Sizes must be an array'),

  body('sizes.*.volumeMl')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Volume must be a positive integer'),

  body('sizes.*.stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer'),

  body('sizes.*.sellingPrice')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Selling price must be greater than 0'),

  body('discountPercentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Discount percentage must be between 0 and 100'),

  body('minOrderQuantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Minimum order quantity must be at least 1'),

  body('maxOrderQuantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Maximum order quantity must be at least 1'),

  // Validation result handler - must be last in the chain
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const messages = errors.array().map(err => err.msg).join(', ');
      return next(new ValidationError(messages));
    }
    next();
  },
];

/**
 * Validate SubProduct update
 */
const validateSubProductUpdate = [
  // Pricing fields
  body('baseSellingPrice')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Base selling price must be greater than 0'),

  body('costPrice')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Cost price must be greater than 0'),

  body('currency')
    .optional()
    .isIn(['NGN', 'USD', 'EUR', 'GBP'])
    .withMessage('Invalid currency'),

  body('taxRate')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Tax rate must be between 0 and 100'),

  body('markupPercentage')
    .optional()
    .isFloat({ min: 0, max: 500 })
    .withMessage('Markup percentage must be between 0 and 500'),

  body('roundUp')
    .optional()
    .isIn(['none', '100', '1000'])
    .withMessage('Invalid round up value'),

  // Sale/Discount fields
  body('isOnSale')
    .optional()
    .isBoolean()
    .withMessage('isOnSale must be a boolean'),

  body('salePrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Sale price must be a positive number'),

  body('saleDiscountPercentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Sale discount percentage must be between 0 and 100'),

  body('saleType')
    .optional()
    .isIn(['percentage', 'fixed', 'flash_sale', 'bundle', 'bogo', null])
    .withMessage('Invalid sale type'),

  body('saleDiscountValue')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Sale discount value must be a positive number'),

  // Override fields
  body('shortDescriptionOverride')
    .optional()
    .isString()
    .withMessage('Short description override must be a string'),

  body('descriptionOverride')
    .optional()
    .isString()
    .withMessage('Description override must be a string'),

  body('customKeywords')
    .optional()
    .isArray()
    .withMessage('Custom keywords must be an array'),

  body('tenantNotes')
    .optional()
    .isString()
    .withMessage('Tenant notes must be a string'),

  // Status & Visibility
  body('status')
    .optional()
    .isIn(['pending', 'active', 'low_stock', 'out_of_stock', 'discontinued', 'hidden', 'draft', 'archived'])
    .withMessage('Invalid status'),

  body('isFeaturedByTenant')
    .optional()
    .isBoolean()
    .withMessage('isFeaturedByTenant must be a boolean'),

  body('isNewArrival')
    .optional()
    .isBoolean()
    .withMessage('isNewArrival must be a boolean'),

  body('isBestSeller')
    .optional()
    .isBoolean()
    .withMessage('isBestSeller must be a boolean'),

  // Inventory fields
  body('stockStatus')
    .optional()
    .isIn(['in_stock', 'low_stock', 'out_of_stock', 'pre_order', 'discontinued'])
    .withMessage('Invalid stock status'),

  body('totalStock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Total stock must be a non-negative integer'),

  body('reservedStock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Reserved stock must be a non-negative integer'),

  body('availableStock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Available stock must be a non-negative integer'),

  body('lowStockThreshold')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Low stock threshold must be a non-negative integer'),

  body('reorderPoint')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Reorder point must be a non-negative integer'),

  body('reorderQuantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Reorder quantity must be at least 1'),

  // Size variants
  body('sellWithoutSizeVariants')
    .optional()
    .isBoolean()
    .withMessage('sellWithoutSizeVariants must be a boolean'),

  body('sizes')
    .optional()
    .isArray()
    .withMessage('Sizes must be an array'),

  // Vendor & Sourcing
  body('vendor')
    .optional()
    .isString()
    .withMessage('Vendor must be a string'),

  body('supplierSKU')
    .optional()
    .isString()
    .withMessage('Supplier SKU must be a string'),

  body('supplierPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Supplier price must be a positive number'),

  body('leadTimeDays')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Lead time days must be a non-negative integer'),

  body('minimumOrderQuantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Minimum order quantity must be at least 1'),

  // Shipping fields
  body('shipping.weight')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Shipping weight must be a positive number'),

  body('shipping.length')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Shipping length must be a positive number'),

  body('shipping.width')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Shipping width must be a positive number'),

  body('shipping.height')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Shipping height must be a positive number'),

  body('shipping.fragile')
    .optional()
    .isBoolean()
    .withMessage('Shipping fragile must be a boolean'),

  body('shipping.requiresAgeVerification')
    .optional()
    .isBoolean()
    .withMessage('Shipping requiresAgeVerification must be a boolean'),

  body('shipping.hazmat')
    .optional()
    .isBoolean()
    .withMessage('Shipping hazmat must be a boolean'),

  body('shipping.shippingClass')
    .optional()
    .isString()
    .withMessage('Shipping class must be a string'),

  // Warehouse fields
  body('warehouse.location')
    .optional()
    .isString()
    .withMessage('Warehouse location must be a string'),

  body('warehouse.zone')
    .optional()
    .isString()
    .withMessage('Warehouse zone must be a string'),

  body('warehouse.aisle')
    .optional()
    .isString()
    .withMessage('Warehouse aisle must be a string'),

  body('warehouse.shelf')
    .optional()
    .isString()
    .withMessage('Warehouse shelf must be a string'),

  body('warehouse.bin')
    .optional()
    .isString()
    .withMessage('Warehouse bin must be a string'),

  // Discount fields
  body('discount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Discount must be a positive number'),

  body('discountType')
    .optional()
    .isIn(['fixed', 'percentage', null])
    .withMessage('Invalid discount type'),

  // Flash sale fields
  body('flashSale.isActive')
    .optional()
    .isBoolean()
    .withMessage('Flash sale isActive must be a boolean'),

  body('flashSale.discountPercentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Flash sale discount percentage must be between 0 and 100'),

  body('flashSale.remainingQuantity')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Flash sale remaining quantity must be a non-negative integer'),

  // Legacy fields (for backward compatibility)
  body('discountPercentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Discount percentage must be between 0 and 100'),

  body('availability')
    .optional()
    .isIn(['available', 'low_stock', 'out_of_stock', 'pre_order', 'coming_soon', 'discontinued'])
    .withMessage('Invalid availability status'),
];

/**
 * Validate bulk stock update
 */
const validateStockBulkUpdate = [
  body('updates')
    .isArray({ min: 1 })
    .withMessage('Updates array is required and must not be empty'),

  body('updates.*.sizeId')
    .notEmpty()
    .withMessage('Size ID is required for each update')
    .isMongoId()
    .withMessage('Invalid size ID'),

  body('updates.*.stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer'),

  body('updates.*.availability')
    .optional()
    .isIn(['available', 'low_stock', 'out_of_stock', 'pre_order', 'coming_soon', 'discontinued'])
    .withMessage('Invalid availability status'),

  body('updates.*.sellingPrice')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Selling price must be greater than 0'),
];

// ============================================================
// CART VALIDATIONS
// ============================================================

/**
 * Validate cart item
 */
const validateCartItem = [
  body('productId')
    .notEmpty()
    .withMessage('Product ID is required')
    .isMongoId()
    .withMessage('Invalid product ID'),

  body('subProductId')
    .notEmpty()
    .withMessage('SubProduct ID is required')
    .isMongoId()
    .withMessage('Invalid SubProduct ID'),

  body('sizeId')
    .notEmpty()
    .withMessage('Size ID is required')
    .isMongoId()
    .withMessage('Invalid size ID'),

  body('quantity')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Quantity must be between 1 and 100'),

  body('tenantId')
    .optional()
    .isMongoId()
    .withMessage('Invalid tenant ID'),
];

/**
 * Validate cart update
 */
const validateCartUpdate = [
  body('quantity')
    .notEmpty()
    .withMessage('Quantity is required')
    .isInt({ min: 1, max: 100 })
    .withMessage('Quantity must be between 1 and 100'),
];

/**
 * Validate apply coupon
 */
const validateApplyCoupon = [
  body('couponCode')
    .notEmpty()
    .withMessage('Coupon code is required')
    .trim()
    .toUpperCase()
    .isLength({ min: 3, max: 50 })
    .withMessage('Coupon code must be between 3 and 50 characters'),
];

// ============================================================
// ORDER VALIDATIONS
// ============================================================

/**
 * Validate order creation
 */
const validateOrderCreation = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('Order must contain at least one item'),

  body('items.*.productId')
    .notEmpty()
    .withMessage('Product ID is required for each item')
    .isMongoId()
    .withMessage('Invalid product ID'),

  body('items.*.subProductId')
    .notEmpty()
    .withMessage('SubProduct ID is required for each item')
    .isMongoId()
    .withMessage('Invalid SubProduct ID'),

  body('items.*.sizeId')
    .notEmpty()
    .withMessage('Size ID is required for each item')
    .isMongoId()
    .withMessage('Invalid size ID'),

  body('items.*.quantity')
    .notEmpty()
    .withMessage('Quantity is required for each item')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1'),

  body('shipping')
    .notEmpty()
    .withMessage('Shipping address is required')
    .isObject()
    .withMessage('Shipping address must be an object'),

  body('shipping.address')
    .notEmpty()
    .withMessage('Address is required'),

  body('shipping.city')
    .notEmpty()
    .withMessage('City is required'),

  body('shipping.state')
    .notEmpty()
    .withMessage('State is required'),

  body('shipping.zipCode')
    .notEmpty()
    .withMessage('ZIP code is required'),

  body('shipping.country')
    .notEmpty()
    .withMessage('Country is required'),

  body('customer')
    .notEmpty()
    .withMessage('Customer information is required')
    .isObject()
    .withMessage('Customer must be an object'),

  body('customer.firstName')
    .notEmpty()
    .withMessage('First name is required'),

  body('customer.lastName')
    .notEmpty()
    .withMessage('Last name is required'),

  body('customer.email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format'),

  body('customer.phone')
    .notEmpty()
    .withMessage('Phone number is required'),

  body('paymentMethod')
    .notEmpty()
    .withMessage('Payment method is required')
    .isIn(['card', 'bank', 'cod', 'bank_transfer', 'cash_on_delivery', 'wallet', 'ussd'])
    .withMessage('Invalid payment method'),

  body('couponCode')
    .optional()
    .trim()
    .toUpperCase(),
];

/**
 * Validate order status update
 */
const validateOrderStatusUpdate = [
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'])
    .withMessage('Invalid order status'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),
];

// ============================================================
// USER VALIDATIONS
// ============================================================

/**
 * Validate user registration
 */
const validateUserRegistration = [
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number and special character'),

  body('firstName')
    .notEmpty()
    .withMessage('First name is required')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),

  body('lastName')
    .notEmpty()
    .withMessage('Last name is required')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),

  body('phoneNumber')
    .optional()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Invalid phone number format'),
];

/**
 * Validate user login
 */
const validateUserLogin = [
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

/**
 * Validate user update
 */
const validateUserUpdate = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),

  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),

  body('phoneNumber')
    .optional()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Invalid phone number format'),

  body('email')
    .optional()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),
];

/**
 * Validate password change
 */
const validatePasswordChange = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),

  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number and special character'),
];

// ============================================================
// REVIEW VALIDATIONS
// ============================================================

/**
 * Validate review creation
 */
const validateReviewCreation = [
  body('productId')
    .notEmpty()
    .withMessage('Product ID is required')
    .isMongoId()
    .withMessage('Invalid product ID'),

  body('rating')
    .notEmpty()
    .withMessage('Rating is required')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),

  body('title')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Title cannot exceed 100 characters'),

  body('comment')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Comment cannot exceed 1000 characters'),
];

/**
 * Validate review update
 */
const validateReviewUpdate = [
  body('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),

  body('title')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Title cannot exceed 100 characters'),

  body('comment')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Comment cannot exceed 1000 characters'),
];

// ============================================================
// QUERY VALIDATIONS
// ============================================================

/**
 * Validate pagination query
 */
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

/**
 * Validate search query
 */
const validateSearch = [
  query('q')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Search query must be between 1 and 200 characters'),

  query('category')
    .optional()
    .isMongoId()
    .withMessage('Invalid category ID'),

  query('brand')
    .optional()
    .isMongoId()
    .withMessage('Invalid brand ID'),

  query('minPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum price must be non-negative'),

  query('maxPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum price must be non-negative'),

  query('minABV')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Minimum ABV must be between 0 and 100'),

  query('maxABV')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Maximum ABV must be between 0 and 100'),

  query('sortBy')
    .optional()
    .isIn(['name', 'price', 'rating', 'createdAt', 'popularity'])
    .withMessage('Invalid sort field'),

  query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Order must be either asc or desc'),
];

// ============================================================
// TENANT VALIDATIONS
// ============================================================

/**
 * Validate tenant creation
 */
const validateTenantCreation = [
  body('name')
    .notEmpty()
    .withMessage('Tenant name is required')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Tenant name must be between 2 and 100 characters'),

  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),

  body('phoneNumber')
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Invalid phone number format'),

  body('businessType')
    .notEmpty()
    .withMessage('Business type is required')
    .isIn(['bar', 'restaurant', 'liquor_store', 'distributor', 'brewery', 'winery', 'other'])
    .withMessage('Invalid business type'),

  body('city')
    .notEmpty()
    .withMessage('City is required'),

  body('state')
    .notEmpty()
    .withMessage('State is required'),

  body('country')
    .notEmpty()
    .withMessage('Country is required'),

  body('revenueModel')
    .optional()
    .isIn(['markup', 'commission'])
    .withMessage('Invalid revenue model'),

  body('markupPercentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Markup percentage must be between 0 and 100'),

  body('commissionPercentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Commission percentage must be between 0 and 100'),
];

/**
 * Validate tenant update
 */
const validateTenantUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Tenant name must be between 2 and 100 characters'),

  body('email')
    .optional()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),

  body('phoneNumber')
    .optional()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Invalid phone number format'),

  body('status')
    .optional()
    .isIn(['pending', 'approved', 'suspended', 'rejected'])
    .withMessage('Invalid status'),
];

module.exports = {
  validate,

  // Product validations
  validateProductCreation,
  validateProductUpdate,
  validateProductImport,
  validateMongoId,
  validateProductSlug,

  // SubProduct validations
  validateSubProductCreation,
  validateSubProductUpdate,
  validateStockBulkUpdate,

  // Cart validations
  validateCartItem,
  validateCartUpdate,
  validateApplyCoupon,

  // Order validations
  validateOrderCreation,
  validateOrderStatusUpdate,

  // User validations
  validateUserRegistration,
  validateUserLogin,
  validateUserUpdate,
  validatePasswordChange,

  // Review validations
  validateReviewCreation,
  validateReviewUpdate,

  // Query validations
  validatePagination,
  validateSearch,

  // Tenant validations
  validateTenantCreation,
  validateTenantUpdate,
};
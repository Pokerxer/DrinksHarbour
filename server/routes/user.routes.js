// routes/user.routes.js

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const userController = require('../controllers/user.controller');
const { protect, authorize, superAdminOnly } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const { body, param, query } = require('express-validator');

// ============================================================
// AUTH ENDPOINT RATE LIMITERS
// Per-IP throttling to prevent brute-force on auth endpoints.
// The global /api limiter (100 req/15min) still applies; these are stricter.
// ============================================================

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 login attempts per IP per 15 min (account lockout handles the rest at 5)
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts from this IP. Please try again later.' },
  validate: { xForwardedForHeader: false, forwardedHeader: false },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 registrations per IP per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many registration attempts from this IP. Please try again later.' },
  validate: { xForwardedForHeader: false, forwardedHeader: false },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 password reset requests per IP per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many password reset requests from this IP. Please try again later.' },
  validate: { xForwardedForHeader: false, forwardedHeader: false },
});

const refreshTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 refresh requests per IP per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many token refresh requests. Please try again later.' },
  validate: { xForwardedForHeader: false, forwardedHeader: false },
});

// ============================================================
// VALIDATION RULES
// ============================================================

const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number and special character'),
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ max: 50 })
    .withMessage('First name cannot exceed 50 characters'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ max: 50 })
    .withMessage('Last name cannot exceed 50 characters'),
  body('phoneNumber')
    .optional()
    .matches(/^(\+?234|0)[7-9][01]\d{8}$/)
    .withMessage('Please provide a valid Nigerian phone number (e.g. 07035609301 or +2347035609301)'),
  body('role')
    .optional()
    .isIn(['customer', 'tenant_admin', 'admin', 'super_admin'])
    .withMessage('Invalid role'),
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

const updateUserValidation = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('First name cannot exceed 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Last name cannot exceed 50 characters'),
  body('phoneNumber')
    .optional()
    .matches(/^(\+?234|0)[7-9][01]\d{8}$/)
    .withMessage('Please provide a valid Nigerian phone number (e.g. 07035609301 or +2347035609301)'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number and special character'),
];

const resetPasswordValidation = [
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number and special character'),
];

const verifyAgeValidation = [
  body('dateOfBirth')
    .isISO8601()
    .withMessage('Please provide a valid date of birth'),
  body('verificationMethod')
    .optional()
    .isIn(['self_declaration', 'id_verification', 'third_party'])
    .withMessage('Invalid verification method'),
];

const mongoIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid user ID'),
];

// ============================================================
// PUBLIC ROUTES
// ============================================================

/**
 * Register new user
 * @route POST /api/users/register
 */
router.post(
  '/register',
  registerLimiter,
  registerValidation,
  validate,
  userController.registerUser
);

/**
 * Login user
 * @route POST /api/users/login
 */
router.post(
  '/login',
  loginLimiter,
  loginValidation,
  validate,
  userController.loginUser
);

/**
 * Request password reset
 * @route POST /api/users/forgot-password
 */
router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  [body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email')],
  validate,
  userController.requestPasswordReset
);

/**
 * Reset password with token
 * @route POST /api/users/reset-password/:token
 */
router.post(
  '/reset-password/:token',
  [
    param('token').notEmpty().withMessage('Reset token is required'),
    ...resetPasswordValidation,
  ],
  validate,
  userController.resetPassword
);

/**
 * Verify email with token
 * @route GET /api/users/verify-email/:token
 */
router.get(
  '/verify-email/:token',
  [param('token').notEmpty().withMessage('Verification token is required')],
  validate,
  userController.verifyEmail
);

/**
 * Resend email verification
 * @route POST /api/users/resend-verification
 */
router.post(
  '/resend-verification',
  [body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email')],
  validate,
  userController.resendEmailVerification
);

/**
 * Refresh authentication token
 * @route POST /api/users/refresh-token
 */
router.post(
  '/refresh-token',
  refreshTokenLimiter,
  [body('refreshToken').notEmpty().withMessage('Refresh token is required')],
  validate,
  userController.refreshAuthToken
);

// ============================================================
// PROTECTED ROUTES (Authenticated Users)
// ============================================================

router.use(protect);

/**
 * Get current user profile
 * @route GET /api/users/me
 */
router.get('/me', userController.getMyProfile);

/**
 * Update current user profile
 * @route PUT /api/users/me
 */
router.put(
  '/me',
  updateUserValidation,
  validate,
  userController.updateMyProfile
);

/**
 * Change password
 * @route POST /api/users/change-password
 */
router.post(
  '/change-password',
  changePasswordValidation,
  validate,
  userController.changePassword
);

/**
 * Verify age
 * @route POST /api/users/verify-age
 */
router.post(
  '/verify-age',
  verifyAgeValidation,
  validate,
  userController.verifyAge
);

/**
 * Update preferences
 * @route PATCH /api/users/preferences
 */
router.patch('/preferences', userController.updatePreferences);

/**
 * Update avatar
 * @route POST /api/users/avatar
 */
router.post(
  '/avatar',
  [body('avatarUrl').isURL().withMessage('Please provide a valid avatar URL')],
  validate,
  userController.updateAvatar
);

/**
 * Logout
 * @route POST /api/users/logout
 */
router.post('/logout', userController.logoutUser);

/**
 * Get recently viewed products
 * @route GET /api/users/recently-viewed
 */
router.get('/recently-viewed', userController.getRecentlyViewed);

/**
 * Add product to recently viewed
 * @route POST /api/users/recently-viewed
 */
router.post('/recently-viewed', userController.addRecentlyViewed);

/**
 * Clear recently viewed products
 * @route DELETE /api/users/recently-viewed
 */
router.delete('/recently-viewed', userController.clearRecentlyViewed);

// ============================================================
// ADMIN ROUTES
// ============================================================

router.use(authorize('admin', 'super_admin'));

/**
 * Search users
 * @route GET /api/users/search
 */
router.get(
  '/search',
  [query('q').notEmpty().withMessage('Search query is required')],
  validate,
  userController.searchUsers
);

/**
 * Get all users
 * @route GET /api/users
 */
router.get('/', userController.getAllUsers);

/**
 * Get user statistics
 * @route GET /api/users/stats/summary
 */
router.get('/stats/summary', userController.getUserStatistics);

/**
 * Get users by tenant
 * @route GET /api/users/tenant/:tenantId
 */
router.get(
  '/tenant/:tenantId',
  [param('tenantId').isMongoId().withMessage('Invalid tenant ID')],
  validate,
  userController.getUsersByTenant
);

/**
 * Get user by email
 * @route GET /api/users/email/:email
 */
router.get(
  '/email/:email',
  [param('email').isEmail().normalizeEmail().withMessage('Invalid email format')],
  validate,
  userController.getUserByEmail
);

/**
 * Get user activity log
 * @route GET /api/users/:id/activity
 */
router.get(
  '/:id/activity',
  mongoIdValidation,
  validate,
  userController.getUserActivityLog
);

/**
 * Get user by ID
 * @route GET /api/users/:id
 */
router.get(
  '/:id',
  mongoIdValidation,
  validate,
  userController.getUserById
);

/**
 * Update user
 * @route PUT /api/users/:id
 */
router.put(
  '/:id',
  [
    ...mongoIdValidation,
    ...updateUserValidation,
  ],
  validate,
  userController.updateUser
);

/**
 * Bulk update users
 * @route PATCH /api/users/bulk
 */
router.patch(
  '/bulk',
  [
    body('userIds')
      .isArray({ min: 1 })
      .withMessage('User IDs array is required and must not be empty'),
    body('userIds.*')
      .isMongoId()
      .withMessage('Invalid user ID in array'),
    body('updateData')
      .isObject()
      .withMessage('Update data must be an object'),
  ],
  validate,
  userController.bulkUpdateUsers
);

/**
 * Delete user
 * @route DELETE /api/users/:id
 */
router.delete(
  '/:id',
  mongoIdValidation,
  validate,
  userController.deleteUser
);

/**
 * Permanently delete user
 * @route DELETE /api/users/:id/permanent
 * @access Private/SuperAdmin
 */
router.delete(
  '/:id/permanent',
  mongoIdValidation,
  validate,
  authorize('super_admin'),
  superAdminOnly,
  userController.permanentlyDeleteUser
);

/**
 * Suspend user
 * @route POST /api/users/:id/suspend
 */
router.post(
  '/:id/suspend',
  [
    ...mongoIdValidation,
    body('reason').optional().trim().isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters'),
  ],
  validate,
  userController.suspendUser
);

/**
 * Activate user
 * @route POST /api/users/:id/activate
 */
router.post(
  '/:id/activate',
  mongoIdValidation,
  validate,
  userController.activateUser
);

module.exports = router;
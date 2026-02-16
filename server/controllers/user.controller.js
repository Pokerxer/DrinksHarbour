// controllers/user.controller.js

const userService = require('../services/user.service');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');

/**
 * @desc    Register new user
 * @route   POST /api/users/register
 * @access  Public
 */
exports.registerUser = asyncHandler(async (req, res) => {
  const result = await userService.registerUser(req.body);

  successResponse(res, result, 'User registered successfully. Please verify your email.', 201);
});

/**
 * @desc    Login user
 * @route   POST /api/users/login
 * @access  Public
 */
exports.loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide email and password',
    });
  }

  const result = await userService.loginUser(email, password);

  successResponse(res, result, 'Login successful');
});

/**
 * @desc    Get all users
 * @route   GET /api/users
 * @access  Private/Admin
 */
exports.getAllUsers = asyncHandler(async (req, res) => {
  const result = await userService.getAllUsers(req.query);

  successResponse(res, result, 'Users retrieved successfully');
});

/**
 * @desc    Get user by ID
 * @route   GET /api/users/:id
 * @access  Private/Admin or Self
 */
exports.getUserById = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.id);

  successResponse(res, user, 'User retrieved successfully');
});

/**
 * @desc    Get current user profile
 * @route   GET /api/users/me
 * @access  Private
 */
exports.getMyProfile = asyncHandler(async (req, res) => {
  const user = await userService.getUserProfile(req.user._id);

  successResponse(res, user, 'Profile retrieved successfully');
});

/**
 * @desc    Update user
 * @route   PUT /api/users/:id
 * @access  Private/Admin or Self
 */
exports.updateUser = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(
    req.params.id,
    req.body,
    req.user._id,
    req.user.role
  );

  successResponse(res, user, 'User updated successfully');
});

/**
 * @desc    Update current user profile
 * @route   PUT /api/users/me
 * @access  Private
 */
exports.updateMyProfile = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(
    req.user._id,
    req.body,
    req.user._id,
    req.user.role
  );

  successResponse(res, user, 'Profile updated successfully');
});

/**
 * @desc    Delete user
 * @route   DELETE /api/users/:id
 * @access  Private/Admin
 */
exports.deleteUser = asyncHandler(async (req, res) => {
  const result = await userService.deleteUser(req.params.id);

  successResponse(res, result, 'User deleted successfully');
});

/**
 * @desc    Change password
 * @route   POST /api/users/change-password
 * @access  Private
 */
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Please provide current password and new password',
    });
  }

  const result = await userService.changePassword(
    req.user._id,
    currentPassword,
    newPassword
  );

  successResponse(res, result, 'Password changed successfully');
});

/**
 * @desc    Request password reset
 * @route   POST /api/users/forgot-password
 * @access  Public
 */
exports.requestPasswordReset = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Please provide email address',
    });
  }

  const result = await userService.requestPasswordReset(email);

  successResponse(res, result, 'Password reset instructions sent');
});

/**
 * @desc    Reset password with token
 * @route   POST /api/users/reset-password/:token
 * @access  Public
 */
exports.resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  if (!newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Please provide new password',
    });
  }

  const result = await userService.resetPassword(token, newPassword);

  successResponse(res, result, 'Password reset successful');
});

/**
 * @desc    Verify email with token
 * @route   GET /api/users/verify-email/:token
 * @access  Public
 */
exports.verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const result = await userService.verifyEmail(token);

  successResponse(res, result, 'Email verified successfully');
});

/**
 * @desc    Resend email verification
 * @route   POST /api/users/resend-verification
 * @access  Public
 */
exports.resendEmailVerification = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Please provide email address',
    });
  }

  const result = await userService.resendEmailVerification(email);

  successResponse(res, result, 'Verification email sent');
});

/**
 * @desc    Verify age
 * @route   POST /api/users/verify-age
 * @access  Private
 */
exports.verifyAge = asyncHandler(async (req, res) => {
  const { dateOfBirth, verificationMethod } = req.body;

  if (!dateOfBirth) {
    return res.status(400).json({
      success: false,
      message: 'Please provide date of birth',
    });
  }

  const result = await userService.verifyAge(
    req.user._id,
    dateOfBirth,
    verificationMethod
  );

  successResponse(res, result, 'Age verified successfully');
});

/**
 * @desc    Update user preferences
 * @route   PATCH /api/users/preferences
 * @access  Private
 */
exports.updatePreferences = asyncHandler(async (req, res) => {
  const result = await userService.updateUserPreferences(req.user._id, req.body);

  successResponse(res, result, 'Preferences updated successfully');
});

/**
 * @desc    Update user avatar
 * @route   POST /api/users/avatar
 * @access  Private
 */
exports.updateAvatar = asyncHandler(async (req, res) => {
  const { avatarUrl } = req.body;

  if (!avatarUrl) {
    return res.status(400).json({
      success: false,
      message: 'Please provide avatar URL',
    });
  }

  const result = await userService.updateUserAvatar(req.user._id, avatarUrl);

  successResponse(res, result, 'Avatar updated successfully');
});

/**
 * @desc    Suspend user
 * @route   POST /api/users/:id/suspend
 * @access  Private/Admin
 */
exports.suspendUser = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const result = await userService.suspendUser(req.params.id, reason, req.user._id);

  successResponse(res, result, 'User suspended successfully');
});

/**
 * @desc    Activate user
 * @route   POST /api/users/:id/activate
 * @access  Private/Admin
 */
exports.activateUser = asyncHandler(async (req, res) => {
  const result = await userService.activateUser(req.params.id, req.user._id);

  successResponse(res, result, 'User activated successfully');
});

/**
 * @desc    Get users by tenant
 * @route   GET /api/users/tenant/:tenantId
 * @access  Private/Admin or Tenant Admin
 */
exports.getUsersByTenant = asyncHandler(async (req, res) => {
  const result = await userService.getUsersByTenant(req.params.tenantId, req.query);

  successResponse(res, result, 'Tenant users retrieved successfully');
});

/**
 * @desc    Logout user (client-side token removal)
 * @route   POST /api/users/logout
 * @access  Private
 */
exports.logoutUser = asyncHandler(async (req, res) => {
  // In a stateless JWT system, logout is handled client-side
  // However, we can log this event if needed
  
  successResponse(res, null, 'Logout successful');
});

/**
 * @desc    Get user statistics
 * @route   GET /api/users/stats/summary
 * @access  Private/Admin
 */
exports.getUserStatistics = asyncHandler(async (req, res) => {
  const result = await userService.getUserStatistics();

  const summary = {
    stats: result,
  };

  successResponse(res, summary, 'User statistics retrieved successfully');
});

/**
 * @desc    Refresh authentication token
 * @route   POST /api/users/refresh-token
 * @access  Public
 */
exports.refreshAuthToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      message: 'Please provide refresh token',
    });
  }

  const result = await userService.refreshAuthToken(refreshToken);

  successResponse(res, result, 'Token refreshed successfully');
});

/**
 * @desc    Get user by email
 * @route   GET /api/users/email/:email
 * @access  Private/Admin
 */
exports.getUserByEmail = asyncHandler(async (req, res) => {
  const { email } = req.params;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Please provide email address',
    });
  }

  const user = await userService.getUserByEmail(email);

  successResponse(res, user, 'User retrieved successfully');
});

/**
 * @desc    Get user activity log
 * @route   GET /api/users/:id/activity
 * @access  Private/Admin or Self
 */
exports.getUserActivityLog = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 20 } = req.query;

  const activityLog = await userService.getUserActivityLog(id, { page: parseInt(page), limit: parseInt(limit) });

  successResponse(res, activityLog, 'Activity log retrieved successfully');
});

/**
 * @desc    Search users
 * @route   GET /api/users/search
 * @access  Private/Admin
 */
exports.searchUsers = asyncHandler(async (req, res) => {
  const { q, limit = 10, role, status } = req.query;

  if (!q) {
    return res.status(400).json({
      success: false,
      message: 'Please provide search query',
    });
  }

  const users = await userService.searchUsers(q, { 
    limit: parseInt(limit), 
    role, 
    status 
  });

  successResponse(res, users, 'Search results retrieved successfully');
});

/**
 * @desc    Bulk update users
 * @route   PATCH /api/users/bulk
 * @access  Private/Admin
 */
exports.bulkUpdateUsers = asyncHandler(async (req, res) => {
  const { userIds, updateData } = req.body;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Please provide an array of user IDs',
    });
  }

  if (!updateData || typeof updateData !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'Please provide update data',
    });
  }

  const result = await userService.bulkUpdateUsers(userIds, updateData, req.user._id, req.user.role);

  successResponse(res, result, 'Users updated successfully');
});

/**
 * @desc    Permanently delete user
 * @route   DELETE /api/users/:id/permanent
 * @access  Private/SuperAdmin
 */
exports.permanentlyDeleteUser = asyncHandler(async (req, res) => {
  const result = await userService.permanentlyDeleteUser(req.params.id);

  successResponse(res, result, 'User permanently deleted');
});
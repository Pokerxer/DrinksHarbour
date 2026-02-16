// services/user.service.js

const User = require('../models/user');
const Tenant = require('../models/tenant'); // Changed from '../models/tenant' to '../models/Tenant' for consistency
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { NotFoundError, ValidationError, AuthorizationError } = require('../utils/errors');
const mongoose = require('mongoose');

/**
 * Register a new user
 */
const registerUser = async (userData) => {
  const {
    email,
    password,
    firstName,
    lastName,
    phoneNumber,
    role = 'customer',
    tenant,
    dateOfBirth,
  } = userData;

  console.log('userData', userData);
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Please provide a valid email address');
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new ValidationError('User with this email already exists');
  }

  // Validate role
  const validRoles = ['customer', 'tenant_admin', 'admin', 'super_admin'];
  if (!validRoles.includes(role)) {
    throw new ValidationError('Invalid role');
  }

  // Validate password strength
  if (password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters long');
  }

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
  if (!passwordRegex.test(password)) {
    throw new ValidationError(
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    );
  }

  // Validate tenant for tenant_admin role
  if (role === 'tenant_admin') {
    if (!tenant) {
      throw new ValidationError('Tenant is required for tenant_admin role');
    }

    const tenantExists = await Tenant.findById(tenant);
    if (!tenantExists) {
      throw new NotFoundError('Tenant not found');
    }

    if (tenantExists.status !== 'approved') {
      throw new ValidationError('Tenant is not approved yet');
    }
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  // Prepare user data
  const newUserData = {
    email: email.toLowerCase(),
    passwordHash,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    displayName: `${firstName.trim()} ${lastName.trim()}`,
    phoneNumber,
    role,
    status: 'active',
    isEmailVerified: false,
    isAgeVerified: false,
  };

  // Add tenant if provided
  if (tenant) {
    newUserData.tenant = tenant;
  }

  // Add date of birth if provided
  if (dateOfBirth) {
    newUserData.dateOfBirth = new Date(dateOfBirth);
  }

  // Create user
  const user = await User.create(newUserData);

  // Generate email verification token
  const verificationToken = user.generateEmailVerificationToken();
  await user.save();

  // Generate auth token
  const token = generateAuthToken(user);

  // Remove sensitive data
  const userResponse = sanitizeUser(user.toObject());

  return {
    user: userResponse,
    token,
    verificationToken, // Can be used to send verification email
    message: 'User registered successfully. Please verify your email.',
  };
};

/**
 * Login user
 */
const loginUser = async (email, password, options = {}) => {
  const { ipAddress, userAgent } = options;

  // Find user
  const user = await User.findOne({ email: email.toLowerCase() })
    .select('+passwordHash')
    .populate('tenant', 'name slug status subscriptionStatus logo primaryColor');

  if (!user) {
    throw new ValidationError('Invalid email or password');
  }

  // Check if account is locked
  if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
    const minutesLeft = Math.ceil((user.accountLockedUntil - new Date()) / 60000);
    throw new AuthorizationError(
      `Account is locked due to multiple failed login attempts. Try again in ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}.`
    );
  }

  // Check password
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    // Increment failed login attempts
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    user.lastFailedLogin = new Date();

    // Lock account after 5 failed attempts
    if (user.failedLoginAttempts >= 5) {
      user.accountLockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      await user.save();
      throw new AuthorizationError(
        'Account locked due to multiple failed login attempts. Please try again in 15 minutes or reset your password.'
      );
    }

    await user.save();
    throw new ValidationError('Invalid email or password');
  }

  // Check account status
  if (user.status === 'suspended') {
    const reason = user.suspensionReason ? ` Reason: ${user.suspensionReason}` : '';
    throw new AuthorizationError(`Your account has been suspended.${reason} Please contact support.`);
  }

  if (user.status === 'inactive') {
    throw new AuthorizationError('Your account is inactive. Please contact support to reactivate.');
  }

  if (user.status === 'deleted') {
    throw new AuthorizationError('This account has been deleted.');
  }

  // Check tenant status for tenant_admin
  if (user.role === 'tenant_admin' && user.tenant) {
    if (user.tenant.status !== 'approved') {
      throw new AuthorizationError('Your tenant account is not approved yet. Please wait for admin approval.');
    }
    if (!['active', 'trialing'].includes(user.tenant.subscriptionStatus)) {
      throw new AuthorizationError('Your tenant subscription is not active. Please renew your subscription.');
    }
  }

  // Reset failed login attempts
  user.failedLoginAttempts = 0;
  user.accountLockedUntil = null;
  user.lastLogin = new Date();
  user.lastLoginIp = ipAddress;
  user.lastLoginUserAgent = userAgent;
  await user.save();

  // Generate auth token
  const token = generateAuthToken(user);

  // Create refresh token
  const refreshToken = generateRefreshToken(user);

  // Remove sensitive data
  const userResponse = sanitizeUser(user.toObject());

  return {
    user: userResponse,
    token,
    refreshToken,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  };
};

/**
 * Refresh authentication token
 */
const refreshAuthToken = async (refreshToken) => {
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId)
      .populate('tenant', 'name slug status subscriptionStatus');

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.status !== 'active') {
      throw new AuthorizationError('Account is not active');
    }

    // Generate new tokens
    const newToken = generateAuthToken(user);
    const newRefreshToken = generateRefreshToken(user);

    return {
      token: newToken,
      refreshToken: newRefreshToken,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    };
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      throw new AuthorizationError('Invalid or expired refresh token');
    }
    throw error;
  }
};

/**
 * Get all users with filtering and pagination
 */
const getAllUsers = async (queryParams = {}) => {
  const {
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    order = 'desc',
    
    // Filters
    role,
    status,
    tenant,
    isEmailVerified,
    isAgeVerified,
    search,
    createdAfter,
    createdBefore,
    lastLoginAfter,
    lastLoginBefore,
  } = queryParams;

  const skip = (page - 1) * limit;

  // Build query
  const query = {};

  if (role) {
    query.role = Array.isArray(role) ? { $in: role } : role;
  }

  if (status) {
    query.status = Array.isArray(status) ? { $in: status } : status;
  }

  if (tenant) {
    query.tenant = tenant;
  }

  if (isEmailVerified !== undefined) {
    query.isEmailVerified = isEmailVerified === 'true' || isEmailVerified === true;
  }

  if (isAgeVerified !== undefined) {
    query.isAgeVerified = isAgeVerified === 'true' || isAgeVerified === true;
  }

  if (search) {
    const searchRegex = new RegExp(search, 'i');
    query.$or = [
      { email: searchRegex },
      { firstName: searchRegex },
      { lastName: searchRegex },
      { displayName: searchRegex },
      { phoneNumber: searchRegex },
    ];
  }

  // Date filters
  if (createdAfter || createdBefore) {
    query.createdAt = {};
    if (createdAfter) query.createdAt.$gte = new Date(createdAfter);
    if (createdBefore) query.createdAt.$lte = new Date(createdBefore);
  }

  if (lastLoginAfter || lastLoginBefore) {
    query.lastLogin = {};
    if (lastLoginAfter) query.lastLogin.$gte = new Date(lastLoginAfter);
    if (lastLoginBefore) query.lastLogin.$lte = new Date(lastLoginBefore);
  }

  // Build sort
  const sortOrder = order === 'asc' ? 1 : -1;
  const sort = { [sortBy]: sortOrder };

  // Execute query
  const [users, total] = await Promise.all([
    User.find(query)
      .populate('tenant', 'name slug logo city state country primaryColor')
      .select('-passwordHash -emailVerificationToken -passwordResetToken -emailVerificationExpires -passwordResetExpires')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    User.countDocuments(query),
  ]);

  // Enrich users with computed data
  const enrichedUsers = users.map(user => enrichUserData(user));

  // Calculate pagination
  const totalPages = Math.ceil(total / limit);

  // Get statistics
  const stats = await getUserStatistics(query);

  return {
    users: enrichedUsers,
    pagination: {
      currentPage: parseInt(page),
      totalPages,
      totalResults: total,
      resultsPerPage: parseInt(limit),
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
    stats,
  };
};

/**
 * Get user by ID
 */
const getUserById = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ValidationError('Invalid user ID format');
  }

  const user = await User.findById(userId)
    .populate('tenant', 'name slug logo city state country revenueModel primaryColor')
    .select('-passwordHash -emailVerificationToken -passwordResetToken -emailVerificationExpires -passwordResetExpires')
    .lean();

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return enrichUserData(user);
};

/**
 * Get user by email
 */
const getUserByEmail = async (email) => {
  const user = await User.findOne({ email: email.toLowerCase() })
    .populate('tenant', 'name slug logo')
    .select('-passwordHash -emailVerificationToken -passwordResetToken')
    .lean();

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return enrichUserData(user);
};

/**
 * Find user by email (returns null if not found)
 * @param {string} email - User email
 * @returns {Object|null} User object or null
 */
const findUserByEmail = async (email) => {
  const user = await User.findOne({ email: email.toLowerCase() })
    .select('_id email')
    .lean();
  
  return user || null;
};

/**
 * Update user
 */
const updateUser = async (userId, updateData, requestingUserId, requestingUserRole) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ValidationError('Invalid user ID format');
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Authorization check
  const isSelf = userId === requestingUserId.toString();
  const isAdmin = ['admin', 'super_admin'].includes(requestingUserRole);
  const isTenantAdmin = requestingUserRole === 'tenant_admin';

  if (!isSelf && !isAdmin && !isTenantAdmin) {
    throw new AuthorizationError('You are not authorized to update this user');
  }

  // Tenant admins can only update users in their tenant
  if (isTenantAdmin && !isAdmin) {
    const requestingUser = await User.findById(requestingUserId);
    if (!requestingUser.tenant || user.tenant?.toString() !== requestingUser.tenant?.toString()) {
      throw new AuthorizationError('You can only update users in your tenant');
    }
  }

  // Fields that only admins can update
  const adminOnlyFields = ['role', 'status', 'isEmailVerified', 'isAgeVerified', 'tenant'];
  
  if (!isAdmin) {
    adminOnlyFields.forEach(field => {
      if (updateData[field] !== undefined) {
        delete updateData[field];
      }
    });
  }

  // Prevent role escalation
  if (updateData.role && !isAdmin) {
    delete updateData.role;
  }

  // Super admin cannot be changed by anyone
  if (user.role === 'super_admin' && updateData.role && updateData.role !== 'super_admin') {
    throw new AuthorizationError('Cannot modify super admin role');
  }

  // Don't allow updating sensitive fields directly
  const protectedFields = [
    'passwordHash',
    'emailVerificationToken',
    'passwordResetToken',
    'failedLoginAttempts',
    'accountLockedUntil',
    'emailVerificationExpires',
    'passwordResetExpires',
  ];
  
  protectedFields.forEach(field => delete updateData[field]);

  // Update email
  if (updateData.email && updateData.email !== user.email) {
    const emailExists = await User.findOne({ 
      email: updateData.email.toLowerCase(),
      _id: { $ne: userId },
    });
    
    if (emailExists) {
      throw new ValidationError('Email is already in use');
    }
    
    user.email = updateData.email.toLowerCase();
    user.isEmailVerified = false;
    
    // Generate new verification token
    const verificationToken = user.generateEmailVerificationToken();
    // TODO: Send verification email
  }

  // Update phone number
  if (updateData.phoneNumber && updateData.phoneNumber !== user.phoneNumber) {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(updateData.phoneNumber)) {
      throw new ValidationError('Invalid phone number format');
    }
  }

  // Update other fields
  Object.keys(updateData).forEach(key => {
    if (updateData[key] !== undefined && key !== 'email') {
      user[key] = updateData[key];
    }
  });

  // Update display name if first or last name changed
  if (updateData.firstName || updateData.lastName) {
    user.displayName = `${updateData.firstName || user.firstName} ${updateData.lastName || user.lastName}`;
  }

  // Track who updated
  user.updatedBy = requestingUserId;

  await user.save();

  // Populate and return
  await user.populate('tenant', 'name slug logo city state');

  return sanitizeUser(user.toObject());
};

/**
 * Delete user
 */
const deleteUser = async (userId, requestingUserRole) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ValidationError('Invalid user ID format');
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Don't allow deleting super admin
  if (user.role === 'super_admin') {
    throw new AuthorizationError('Cannot delete super admin account');
  }

  // Soft delete - mark as deleted
  user.status = 'deleted';
  user.deletedAt = new Date();
  await user.save();

  // For hard delete, uncomment below:
  // await user.deleteOne();

  return {
    message: 'User deleted successfully',
    user: {
      _id: user._id,
      email: user.email,
      name: user.displayName,
    },
  };
};

/**
 * Permanently delete user (hard delete)
 */
const permanentlyDeleteUser = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ValidationError('Invalid user ID format');
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (user.role === 'super_admin') {
    throw new AuthorizationError('Cannot delete super admin account');
  }

  // Hard delete
  await user.deleteOne();

  return {
    message: 'User permanently deleted',
    userId: user._id,
  };
};

/**
 * Change password
 */
const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await User.findById(userId).select('+passwordHash');

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Verify current password
  const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isPasswordValid) {
    throw new ValidationError('Current password is incorrect');
  }

  // Validate new password
  if (newPassword.length < 8) {
    throw new ValidationError('Password must be at least 8 characters long');
  }

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
  if (!passwordRegex.test(newPassword)) {
    throw new ValidationError(
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    );
  }

  // Check if new password is same as old
  const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
  if (isSamePassword) {
    throw new ValidationError('New password must be different from current password');
  }

  // Hash new password
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.passwordChangedAt = new Date();
  
  // Clear any account locks
  user.failedLoginAttempts = 0;
  user.accountLockedUntil = null;
  
  await user.save();

  return {
    message: 'Password changed successfully',
  };
};

/**
 * Request password reset
 */
const requestPasswordReset = async (email) => {
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    // Don't reveal if user exists (security best practice)
    return {
      message: 'If an account with that email exists, a password reset link has been sent.',
    };
  }

  // Don't allow reset for deleted or suspended accounts
  if (user.status === 'deleted') {
    return {
      message: 'If an account with that email exists, a password reset link has been sent.',
    };
  }

  // Generate reset token
  const resetToken = user.generatePasswordResetToken();
  await user.save();

  // TODO: Send email with reset link
  // const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

  return {
    message: 'Password reset link has been sent to your email.',
    resetToken, // Return for testing/development (remove in production)
    userId: user._id,
    expiresIn: '1 hour',
  };
};

/**
 * Reset password with token
 */
const resetPassword = async (resetToken, newPassword) => {
  // Validate new password
  if (newPassword.length < 8) {
    throw new ValidationError('Password must be at least 8 characters long');
  }

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
  if (!passwordRegex.test(newPassword)) {
    throw new ValidationError(
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    );
  }

  // Hash token
  const hashedToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Find user with valid token
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  }).select('+passwordHash');

  if (!user) {
    throw new ValidationError('Invalid or expired reset token');
  }

  // Check if new password is same as old
  const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
  if (isSamePassword) {
    throw new ValidationError('New password must be different from your previous password');
  }

  // Set new password
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.passwordChangedAt = new Date();
  
  // Clear any account locks
  user.failedLoginAttempts = 0;
  user.accountLockedUntil = null;
  
  await user.save();

  return {
    message: 'Password has been reset successfully. You can now login with your new password.',
  };
};

/**
 * Verify email with token
 */
const verifyEmail = async (verificationToken) => {
  // Hash token
  const hashedToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');

  // Find user with valid token
  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpires: { $gt: Date.now() },
  });

  if (!user) {
    throw new ValidationError('Invalid or expired verification token');
  }

  // Verify email
  user.isEmailVerified = true;
  user.emailVerifiedAt = new Date();
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  return {
    message: 'Email verified successfully. You can now access all features.',
    user: {
      _id: user._id,
      email: user.email,
      isEmailVerified: user.isEmailVerified,
      emailVerifiedAt: user.emailVerifiedAt,
    },
  };
};

/**
 * Resend email verification
 */
const resendEmailVerification = async (email) => {
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (user.isEmailVerified) {
    throw new ValidationError('Email is already verified');
  }

  // Check if recent verification was sent (rate limiting)
  if (user.emailVerificationExpires && user.emailVerificationExpires > Date.now()) {
    const minutesLeft = Math.ceil((user.emailVerificationExpires - Date.now()) / 60000);
    throw new ValidationError(
      `Verification email was recently sent. Please wait ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''} before requesting a new one.`
    );
  }

  // Generate new verification token
  const verificationToken = user.generateEmailVerificationToken();
  await user.save();

  // TODO: Send verification email
  // const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;

  return {
    message: 'Verification email has been sent to your email address.',
    verificationToken, // Return for testing/development (remove in production)
    expiresIn: '24 hours',
  };
};

/**
 * Verify age
 */
const verifyAge = async (userId, dateOfBirth, verificationMethod = 'self_declaration', documentUrl = null) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (user.isAgeVerified) {
    throw new ValidationError('Age is already verified');
  }

  // Calculate age
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  
  // Validate date is not in future
  if (birthDate > today) {
    throw new ValidationError('Date of birth cannot be in the future');
  }

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  // Check minimum age (18 for alcoholic beverages)
  if (age < 18) {
    throw new ValidationError('You must be 18 or older to purchase alcoholic beverages');
  }

  // Validate verification method
  const validMethods = ['self_declaration', 'id_verification', 'third_party'];
  if (!validMethods.includes(verificationMethod)) {
    throw new ValidationError('Invalid verification method');
  }

  user.isAgeVerified = true;
  user.dateOfBirth = birthDate;
  user.ageVerificationMethod = verificationMethod;
  user.ageVerifiedAt = new Date();
  
  if (documentUrl) {
    user.ageVerificationDocument = documentUrl;
  }

  await user.save();

  return {
    message: 'Age verified successfully. You can now purchase alcoholic beverages.',
    user: {
      _id: user._id,
      isAgeVerified: user.isAgeVerified,
      ageVerifiedAt: user.ageVerifiedAt,
      age,
    },
  };
};

/**
 * Update user preferences
 */
const updateUserPreferences = async (userId, preferences) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Validate preferences structure
  const validPreferenceKeys = [
    'notifications',
    'emailNotifications',
    'smsNotifications',
    'language',
    'currency',
    'theme',
    'newsletter',
    'promotionalEmails',
  ];

  const invalidKeys = Object.keys(preferences).filter(
    key => !validPreferenceKeys.includes(key)
  );

  if (invalidKeys.length > 0) {
    throw new ValidationError(`Invalid preference keys: ${invalidKeys.join(', ')}`);
  }

  // Merge preferences
  user.preferences = {
    ...user.preferences,
    ...preferences,
  };

  await user.save();

  return {
    message: 'Preferences updated successfully',
    preferences: user.preferences,
  };
};

/**
 * Get user profile (self)
 */
const getUserProfile = async (userId) => {
  const user = await User.findById(userId)
    .populate('tenant', 'name slug logo city state country primaryColor subscriptionStatus')
    .select('-passwordHash -emailVerificationToken -passwordResetToken -emailVerificationExpires -passwordResetExpires')
    .lean();

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return enrichUserData(user);
};

/**
 * Update user avatar
 */
const updateUserAvatar = async (userId, avatarUrl) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Validate URL format
  const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
  if (!urlRegex.test(avatarUrl)) {
    throw new ValidationError('Invalid avatar URL format');
  }

  user.avatar = avatarUrl;
  await user.save();

  return {
    message: 'Avatar updated successfully',
    avatar: user.avatar,
  };
};

/**
 * Suspend user account
 */
const suspendUser = async (userId, reason, suspendedBy) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (user.role === 'super_admin') {
    throw new AuthorizationError('Cannot suspend super admin account');
  }

  if (user.status === 'suspended') {
    throw new ValidationError('User is already suspended');
  }

  user.status = 'suspended';
  user.suspendedAt = new Date();
  user.suspensionReason = reason || 'No reason provided';
  user.suspendedBy = suspendedBy;
  await user.save();

  return {
    message: 'User suspended successfully',
    user: {
      _id: user._id,
      email: user.email,
      status: user.status,
      suspendedAt: user.suspendedAt,
      suspensionReason: user.suspensionReason,
    },
  };
};

/**
 * Activate user account
 */
const activateUser = async (userId, activatedBy) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (user.status === 'active') {
    throw new ValidationError('User is already active');
  }

  user.status = 'active';
  user.suspendedAt = undefined;
  user.suspensionReason = undefined;
  user.suspendedBy = undefined;
  user.activatedBy = activatedBy;
  user.activatedAt = new Date();
  
  // Clear account locks
  user.failedLoginAttempts = 0;
  user.accountLockedUntil = null;
  
  await user.save();

  return {
    message: 'User activated successfully',
    user: {
      _id: user._id,
      email: user.email,
      status: user.status,
      activatedAt: user.activatedAt,
    },
  };
};

/**
 * Get users by tenant
 */
const getUsersByTenant = async (tenantId, options = {}) => {
  if (!mongoose.Types.ObjectId.isValid(tenantId)) {
    throw new ValidationError('Invalid tenant ID format');
  }

  const { page = 1, limit = 20, role, status } = options;
  const skip = (page - 1) * limit;

  const query = { tenant: tenantId };
  
  if (role) {
    query.role = role;
  }
  
  if (status) {
    query.status = status;
  }

  const [users, total] = await Promise.all([
    User.find(query)
      .select('-passwordHash -emailVerificationToken -passwordResetToken')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    User.countDocuments(query),
  ]);

  const enrichedUsers = users.map(user => enrichUserData(user));

  return {
    users: enrichedUsers,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalResults: total,
      resultsPerPage: parseInt(limit),
    },
  };
};

/**
 * Get user activity log
 */
const getUserActivityLog = async (userId, options = {}) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ValidationError('Invalid user ID format');
  }

  const { page = 1, limit = 20 } = options;

  const user = await User.findById(userId).lean();
  
  if (!user) {
    throw new NotFoundError('User not found');
  }

  // This is a placeholder - in production, you'd have a separate ActivityLog model
  const activityLog = {
    userId: user._id,
    email: user.email,
    activities: [
      {
        type: 'login',
        timestamp: user.lastLogin,
        ipAddress: user.lastLoginIp,
        userAgent: user.lastLoginUserAgent,
      },
      {
        type: 'registration',
        timestamp: user.createdAt,
      },
      {
        type: 'email_verification',
        timestamp: user.emailVerifiedAt,
        verified: user.isEmailVerified,
      },
      {
        type: 'age_verification',
        timestamp: user.ageVerifiedAt,
        verified: user.isAgeVerified,
      },
    ].filter(activity => activity.timestamp),
  };

  return activityLog;
};

/**
 * Bulk update users
 */
const bulkUpdateUsers = async (userIds, updateData, requestingUserId, requestingUserRole) => {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw new ValidationError('User IDs array is required');
  }

  // Validate all IDs
  const invalidIds = userIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
  if (invalidIds.length > 0) {
    throw new ValidationError(`Invalid user IDs: ${invalidIds.join(', ')}`);
  }

  // Only admins can bulk update
  if (!['admin', 'super_admin'].includes(requestingUserRole)) {
    throw new AuthorizationError('Only administrators can perform bulk updates');
  }

  // Don't allow bulk updating super admins
  const users = await User.find({ 
    _id: { $in: userIds },
    role: { $ne: 'super_admin' },
  });

  if (users.length === 0) {
    throw new ValidationError('No valid users found for update');
  }

  // Perform bulk update
  const result = await User.updateMany(
    { 
      _id: { $in: users.map(u => u._id) },
    },
    {
      ...updateData,
      updatedBy: requestingUserId,
    }
  );

  return {
    message: 'Users updated successfully',
    updated: result.modifiedCount,
    total: userIds.length,
  };
};

/**
 * Search users
 */
const searchUsers = async (searchTerm, options = {}) => {
  const { limit = 10, role, status } = options;

  const searchRegex = new RegExp(searchTerm, 'i');
  
  const query = {
    $or: [
      { email: searchRegex },
      { firstName: searchRegex },
      { lastName: searchRegex },
      { displayName: searchRegex },
      { phoneNumber: searchRegex },
    ],
  };

  if (role) {
    query.role = role;
  }

  if (status) {
    query.status = status;
  }

  const users = await User.find(query)
    .select('_id email firstName lastName displayName avatar role status')
    .limit(parseInt(limit))
    .lean();

  return users;
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Generate JWT auth token
 */
function generateAuthToken(user) {
  const payload = {
    userId: user._id,
    email: user.email,
    role: user.role,
    tenant: user.tenant,
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

/**
 * Generate refresh token
 */
function generateRefreshToken(user) {
  const payload = {
    userId: user._id,
    type: 'refresh',
  };

  return jwt.sign(
    payload,
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    }
  );
}

/**
 * Sanitize user object (remove sensitive fields)
 */
function sanitizeUser(user) {
  const sanitized = { ...user };
  
  delete sanitized.passwordHash;
  delete sanitized.emailVerificationToken;
  delete sanitized.emailVerificationExpires;
  delete sanitized.passwordResetToken;
  delete sanitized.passwordResetExpires;
  delete sanitized.__v;
  
  return sanitized;
}

/**
 * Enrich user data with computed fields
 */
function enrichUserData(user) {
  const now = new Date();
  
  return {
    ...user,
    
    // Account age
    accountAge: user.createdAt 
      ? Math.floor((now - new Date(user.createdAt)) / (1000 * 60 * 60 * 24))
      : 0,
    
    // Last login info
    lastLoginDaysAgo: user.lastLogin
      ? Math.floor((now - new Date(user.lastLogin)) / (1000 * 60 * 60 * 24))
      : null,
    
    // Account status indicators
    isLocked: user.accountLockedUntil && new Date(user.accountLockedUntil) > now,
    isSuspended: user.status === 'suspended',
    isActive: user.status === 'active',
    
    // Verification status
    verificationStatus: {
      email: user.isEmailVerified,
      age: user.isAgeVerified,
      emailVerifiedAt: user.emailVerifiedAt,
      ageVerifiedAt: user.ageVerifiedAt,
    },
  };
}

/**
 * Get user statistics
 */
async function getUserStatistics(baseQuery = {}) {
  const stats = await User.aggregate([
    { $match: baseQuery },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        suspended: { $sum: { $cond: [{ $eq: ['$status', 'suspended'] }, 1, 0] } },
        inactive: { $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] } },
        deleted: { $sum: { $cond: [{ $eq: ['$status', 'deleted'] }, 1, 0] } },
        emailVerified: { $sum: { $cond: ['$isEmailVerified', 1, 0] } },
        ageVerified: { $sum: { $cond: ['$isAgeVerified', 1, 0] } },
        customers: { $sum: { $cond: [{ $eq: ['$role', 'customer'] }, 1, 0] } },
        tenantAdmins: { $sum: { $cond: [{ $eq: ['$role', 'tenant_admin'] }, 1, 0] } },
        admins: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } },
        superAdmins: { $sum: { $cond: [{ $eq: ['$role', 'super_admin'] }, 1, 0] } },
      },
    },
  ]);

  return stats[0] || {
    total: 0,
    active: 0,
    suspended: 0,
    inactive: 0,
    deleted: 0,
    emailVerified: 0,
    ageVerified: 0,
    customers: 0,
    tenantAdmins: 0,
    admins: 0,
    superAdmins: 0,
  };
}

module.exports = {
  registerUser,
  loginUser,
  refreshAuthToken,
  getAllUsers,
  getUserById,
  getUserByEmail,
  findUserByEmail,
  updateUser,
  deleteUser,
  permanentlyDeleteUser,
  changePassword,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  resendEmailVerification,
  verifyAge,
  updateUserPreferences,
  getUserProfile,
  updateUserAvatar,
  suspendUser,
  activateUser,
  getUsersByTenant,
  getUserActivityLog,
  bulkUpdateUsers,
  searchUsers,
  getUserStatistics,
};
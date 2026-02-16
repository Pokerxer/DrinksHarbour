// models/User.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema.Types;

const userSchema = new Schema(
  {
    // ────────────────────────────────────────────────
    // Authentication & basic profile
    // ────────────────────────────────────────────────
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      // index: true removed - unique:true already creates index
    },
    passwordHash: {
      type: String,
      select: false,
    },

    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    displayName: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    phone: {
      type: String,
      trim: true,
      sparse: true,
    },
    avatar: {
      url: String,
      publicId: String, // Cloudinary
    },

    // ════════════════════════════════════════════════════════════
    // Role & tenant scoping
    // ════════════════════════════════════════════════════════════
    role: {
      type: String,
      enum: [
        'super_admin',      // platform-wide admin (drinksharbour.com)
        'admin',            // general admin role
        'tenant_owner',     // tenant full control + billing
        'tenant_admin',     // tenant product/order/stock management
        'tenant_staff',     // tenant POS / order fulfillment
        'customer',         // end buyer (main site or tenant stores)
      ],
      required: true,
      default: 'customer',
      index: true,
    },

    tenant: {
      type: ObjectId,
      ref: 'Tenant',
      required: function () {
        // Only required for tenant-related roles
        const tenantRoles = ['tenant_owner', 'tenant_admin', 'tenant_staff'];
        return tenantRoles.includes(this.role);
      },
      validate: {
        validator: function(value) {
          // If role requires tenant, value must exist
          const tenantRoles = ['tenant_owner', 'tenant_admin', 'tenant_staff'];
          if (tenantRoles.includes(this.role)) {
            return value != null;
          }
          // For super_admin and customer, tenant should be null/undefined
          return true;
        },
        message: 'Tenant is required for tenant-related roles'
      },
      sparse: true,
      index: true,
    },

    // ────────────────────────────────────────────────
    // Beverage industry compliance
    // ────────────────────────────────────────────────
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: String,
    emailVerificationExpires: Date,

    isAgeVerified: {
      type: Boolean,
      default: false,
    },
    ageVerificationMethod: {
      type: String,
      enum: ['none', 'id_upload', 'third_party_kyc', 'self_declaration'],
      default: 'none',
    },
    ageVerificationDate: Date,

    // ────────────────────────────────────────────────
    // Customer lightweight trackers
    // (actual items live in separate collections: Cart, Wishlist, Order, Review)
    // ────────────────────────────────────────────────
    wishlistCount: {
      type: Number,
      default: 0,
    },
    activeCartItemCount: {
      type: Number,
      default: 0,
    },
    orderCount: {
      type: Number,
      default: 0,
    },
    pendingReviewCount: {
      type: Number,
      default: 0,
    },

    lastOrderDate: Date,
    lastCartUpdate: Date,
    lastWishlistUpdate: Date,

    // ────────────────────────────────────────────────
    // OAuth / social login support
    // ────────────────────────────────────────────────
    googleId: { type: String, sparse: true, unique: true },
    facebookId: { type: String, sparse: true, unique: true },
    appleId: { type: String, sparse: true, unique: true },

    // ────────────────────────────────────────────────
    // Account status & security
    // ────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended', 'deleted'],
      default: 'active',
      index: true,
    },
    suspendedReason: String,
    suspendedUntil: Date,

    lastLogin: Date,
    loginCount: {
      type: Number,
      default: 0,
    },

    passwordResetToken: String,
    passwordResetExpires: Date,

    // ────────────────────────────────────────────────
    // Customer preferences & personalization
    // ────────────────────────────────────────────────
    preferredCurrency: {
      type: String,
      enum: ['NGN', 'USD', 'EUR', 'GBP'],
      default: 'NGN',
    },
    language: {
      type: String,
      enum: ['en', 'fr'],
      default: 'en',
    },

    preferences: {
      favoriteBeverageTypes: [{ type: String }], // e.g. ['wine', 'non_alcoholic', 'spirit']
      favoriteOrigins: [String],
      preferredPriceRange: {
        min: { type: Number, default: 0 },
        max: { type: Number },
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ────────────────────────────────────────────────
// Virtuals
// ────────────────────────────────────────────────

userSchema.virtual('fullName').get(function () {
  return [this.firstName, this.lastName].filter(Boolean).join(' ') || this.email;
});

userSchema.virtual('isPlatformAdmin').get(function () {
  return this.role === 'super_admin';
});

userSchema.virtual('isTenantUser').get(function () {
  return ['tenant_owner', 'tenant_admin', 'tenant_staff'].includes(this.role);
});

userSchema.virtual('isCustomer').get(function () {
  return this.role === 'customer';
});

// ────────────────────────────────────────────────
// Indexes (removed duplicate indexes - unique:true already creates indexes)
// ────────────────────────────────────────────────
// Note: googleId, facebookId, appleId already have indexes from unique: true
// Note: email already has index from unique: true

// ────────────────────────────────────────────────
// Instance Methods
// ────────────────────────────────────────────────

/**
 * Generate a secure email verification token
 * @returns {string} The plain text verification token
 */
userSchema.methods.generateEmailVerificationToken = function () {
  const crypto = require('crypto');
  
  // Generate a random token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  
  // Hash it for storage
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
  
  // Set expiration (24 hours from now)
  this.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  
  return verificationToken;
};

/**
 * Generate a secure password reset token
 * @returns {string} The plain text reset token
 */
userSchema.methods.generatePasswordResetToken = function () {
  const crypto = require('crypto');
  
  // Generate a random token
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  // Hash it for storage
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  // Set expiration (1 hour from now)
  this.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
  
  return resetToken;
};

/**
 * Check if password matches
 * @param {string} candidatePassword - The password to check
 * @returns {Promise<boolean>}
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  const bcrypt = require('bcryptjs');
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

/**
 * Get user's public profile
 * @returns {Object} Sanitized user object
 */
userSchema.methods.toPublicProfile = function () {
  return {
    _id: this._id,
    email: this.email,
    firstName: this.firstName,
    lastName: this.lastName,
    displayName: this.displayName,
    avatar: this.avatar,
    role: this.role,
    tenant: this.tenant,
    isEmailVerified: this.isEmailVerified,
    isAgeVerified: this.isAgeVerified,
    preferredCurrency: this.preferredCurrency,
    language: this.language,
    createdAt: this.createdAt,
  };
};

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;
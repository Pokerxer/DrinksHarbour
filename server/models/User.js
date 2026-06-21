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

    // Authoritative stored-value wallet balance (NGN) for an ecommerce customer.
    // Mutated only alongside an appended WalletTransaction; never goes negative.
    // (A 'both' contact's wallet lives on its in-store POSCustomer record.)
    walletBalance: {
      type: Number,
      default: 0,
      min: 0,
    },

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

    // ────────────────────────────────────────────────
    // Recently Viewed Products (for customers)
    // ────────────────────────────────────────────────
    recentlyViewedProducts: [{
      product: { type: ObjectId, ref: 'Product' },
      viewedAt: { type: Date, default: Date.now },
    }],

    // ────────────────────────────────────────────────
    // POS Cashier fields
    // ────────────────────────────────────────────────
    posAccess: {
      type: Boolean,
      default: false,
    },
    posPinHash: {
      type: String,
      select: false,
    },
    posName: {
      type: String,
      trim: true,
      maxlength: 60,
    },
    posPermissions: {
      type: [String],
      enum: ['pos:sell', 'pos:refund', 'pos:void', 'pos:price_override', 'pos:discount', 'pos:terminal:retail', 'pos:terminal:wholesale'],
      default: ['pos:sell', 'pos:terminal:retail', 'pos:terminal:wholesale'],
    },

    // ── HR employee profile (tenant staff) ─────────────────────────────────
    // Odoo-style employee record. Only relevant for tenant employees; left
    // empty for customers. Document fields hold uploaded file URLs.
    employeeProfile: {
      privateContact: {
        email: { type: String, trim: true, lowercase: true },
        phone: { type: String, trim: true },
        bankAccounts: [
          {
            _id: false,
            bankName: { type: String, trim: true },
            accountNumber: { type: String, trim: true },
            accountName: { type: String, trim: true },
          },
        ],
      },
      personal: {
        legalName: { type: String, trim: true },
        birthday: { type: Date },
        placeOfBirthCity: { type: String, trim: true },
        placeOfBirthCountry: { type: String, trim: true },
        gender: { type: String, enum: ['male', 'female', 'other', ''], default: '' },
        payslipLanguage: { type: String, trim: true },
      },
      emergencyContact: {
        name: { type: String, trim: true },
        phone: { type: String, trim: true },
      },
      visaWorkPermit: {
        visaNo: { type: String, trim: true },
        workPermitNo: { type: String, trim: true },
        documentUrl: { type: String, trim: true },
      },
      citizenship: {
        nationality: { type: String, trim: true },
        nonResident: { type: Boolean, default: false },
        identificationNo: { type: String, trim: true },
        ssnNo: { type: String, trim: true },
        passportNo: { type: String, trim: true },
      },
      location: {
        address: {
          street: { type: String, trim: true },
          street2: { type: String, trim: true },
          city: { type: String, trim: true },
          state: { type: String, trim: true },
          zip: { type: String, trim: true },
          country: { type: String, trim: true },
        },
        homeWorkDistanceKm: { type: Number, min: 0, default: 0 },
      },
      family: {
        maritalStatus: {
          type: String,
          enum: ['single', 'married', 'divorced', 'widowed', 'cohabitant', ''],
          default: '',
        },
        dependentChildren: { type: Number, min: 0, default: 0 },
      },
      education: {
        certificateLevel: { type: String, trim: true },
        fieldOfStudy: { type: String, trim: true },
      },
      documents: {
        idCardUrl: { type: String, trim: true },
        drivingLicenseUrl: { type: String, trim: true },
        simCardUrl: { type: String, trim: true },
        internetInvoiceUrl: { type: String, trim: true },
      },
      appraisal: {
        nextAppraisalDate: { type: Date },
      },
      approvers: {
        hrResponsible: { type: String, trim: true },
        expense: { type: String, trim: true },
        timeOff: { type: String, trim: true },
      },
      planning: {
        roles: { type: [String], default: [] },
        defaultRole: { type: String, trim: true },
      },
      appSettings: {
        analyticDistribution: { type: String, trim: true },
        hourlyCost: { type: Number, min: 0, default: 0 },
      },
      attendance: {
        rfidBadge: { type: String, trim: true },
      },
      work: {
        department: { type: String, trim: true },
        jobPosition: { type: String, trim: true },
        jobTitle: { type: String, trim: true },
        // Reporting line: another employee in the same tenant. Existence,
        // self-reference and cycles are enforced in the controller.
        manager: { type: ObjectId, ref: 'User' },
        workAddress: {
          company: { type: String, trim: true },
          street: { type: String, trim: true },
          street2: { type: String, trim: true },
          city: { type: String, trim: true },
          zip: { type: String, trim: true },
          country: { type: String, trim: true },
        },
        workLocation: { type: String, trim: true },
        note: { type: String, trim: true },
      },
      timezone: { type: String, trim: true, default: 'Africa/Lagos' },
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
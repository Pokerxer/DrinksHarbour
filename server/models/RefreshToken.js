// models/RefreshToken.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const refreshTokenSchema = new Schema(
  {
    // The refresh token JWT (stored hashed, never plaintext)
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // JWT id (for quick lookup / revocation by jti)
    jti: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Tenant the user belonged to when this token was issued
    tenant: {
      type: ObjectId,
      ref: 'Tenant',
      sparse: true,
      index: true,
    },
    // Token metadata
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
    // Revocation
    revokedAt: {
      type: Date,
      default: null,
      sparse: true,
      index: true,
    },
    revokedBy: {
      type: ObjectId,
      ref: 'User',
      default: null,
    },
    revokeReason: {
      type: String,
      trim: true,
      enum: ['logout', 'password_change', 'security_incident', 'admin_revoke', 'refresh_rotation', 'account_suspended', null],
      default: null,
    },
    // Tracking
    userAgent: { type: String, trim: true },
    ipAddress: { type: String, trim: true },
    // Whether this token was used to issue a new refresh (rotation chain)
    rotated: {
      type: Boolean,
      default: false,
    },
    rotatedTo: {
      type: String, // jti of the new refresh token
      default: null,
    },
  },
  { _id: true, timestamps: false, versionKey: false }
);

// TTL index: hard-delete expired tokens after they expire (auto-cleanup)
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ── Static methods ──────────────────────────────────────────────────────────

/**
 * Store a refresh token (hashed) with its jti.
 * @param {Object} params
 * @param {string} params.jti - unique JWT id
 * @param {string} params.tokenHash - SHA-256 hash of the refresh token JWT
 * @param {ObjectId} params.userId
 * @param {ObjectId} [params.tenantId]
 * @param {Date} params.expiresAt
 * @param {string} [params.userAgent]
 * @param {string} [params.ipAddress]
 */
refreshTokenSchema.statics.store = async function (params) {
  return this.create({
    jti: params.jti,
    tokenHash: params.tokenHash,
    user: params.userId,
    tenant: params.tenantId || undefined,
    expiresAt: params.expiresAt,
    userAgent: params.userAgent,
    ipAddress: params.ipAddress,
  });
};

/**
 * Find a non-revoked, non-expired refresh token by jti.
 * @param {string} jti
 * @returns {Promise<Object|null>}
 */
refreshTokenSchema.statics.findActive = async function (jti) {
  return this.findOne({
    jti,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).lean();
};

/**
 * Revoke a refresh token by jti.
 * @param {string} jti
 * @param {ObjectId} [revokedBy]
 * @param {string} [reason]
 */
refreshTokenSchema.statics.revoke = async function (jti, revokedBy = null, reason = 'logout') {
  return this.updateOne(
    { jti },
    { $set: { revokedAt: new Date(), revokedBy, revokeReason: reason } }
  );
};

/**
 * Revoke ALL refresh tokens for a user (e.g. on password change, suspension).
 * @param {ObjectId} userId
 * @param {ObjectId} [revokedBy]
 * @param {string} [reason]
 */
refreshTokenSchema.statics.revokeAllForUser = async function (userId, revokedBy = null, reason = 'security_incident') {
  return this.updateMany(
    { user: userId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedBy, revokeReason: reason } }
  );
};

/**
 * Mark a token as rotated (used to issue a new refresh token).
 * @param {string} oldJti
 * @param {string} newJti
 */
refreshTokenSchema.statics.markRotated = async function (oldJti, newJti) {
  return this.updateOne(
    { jti: oldJti },
    { $set: { rotated: true, rotatedTo: newJti, revokedAt: new Date(), revokeReason: 'refresh_rotation' } }
  );
};

/**
 * Cleanup: remove expired, already-revoked tokens (optional maintenance).
 */
refreshTokenSchema.statics.cleanupExpired = async function () {
  return this.deleteMany({
    expiresAt: { $lte: new Date() },
  });
};

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
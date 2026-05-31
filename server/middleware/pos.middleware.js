const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Validate POS token from Authorization header.
 * POS tokens have { type: 'pos', userId, tenantId, tenantSlug, posPermissions }
 */
const protectPOS = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'POS token required' });
  }
  const token = authHeader.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired POS token' });
  }
  if (decoded.type !== 'pos') {
    return res.status(401).json({ success: false, message: 'Not a POS token' });
  }
  const user = await User.findById(decoded.userId).select('+posPinHash');
  if (!user || user.status !== 'active') {
    return res.status(401).json({ success: false, message: 'Staff not found or inactive' });
  }

  // ── Tenant isolation: user's stored tenant must match the token claim ──────
  if (!user.tenant || user.tenant.toString() !== String(decoded.tenantId)) {
    return res.status(401).json({ success: false, message: 'Token tenant mismatch' });
  }

  req.posUser = user;
  req.user    = user;   // keep parity with protect() so controllers can use req.user._id
  req.posPermissions = decoded.posPermissions || user.posPermissions || ['pos:sell'];

  // Attach tenant (always from the verified DB record, never from token claim alone)
  const tenant = await Tenant.findById(user.tenant);
  if (!tenant || !tenant.isActive) {
    return res.status(401).json({ success: false, message: 'Tenant not found or inactive' });
  }
  req.tenant = tenant;

  next();
});

/**
 * Require a specific POS permission
 */
const requirePOSPermission = (permission) => (req, res, next) => {
  if (!req.posPermissions?.includes(permission)) {
    return res.status(403).json({ success: false, message: `Permission required: ${permission}` });
  }
  next();
};

/**
 * Accept either a POS token (for cashier terminals) or an admin JWT (for
 * the back-office reporting pages that call read-only POS endpoints).
 *
 * POS token   → full protectPOS path; req.tenant set from POS token's tenantId
 * Admin JWT   → protect path; req.tenant set from user.tenant
 * Unknown     → 401
 */
const protectPOSOrAdmin = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authorization token required' });
  }

  const token = authHeader.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }

  if (decoded.type === 'pos') {
    // ── POS token path ───────────────────────────────────────────────────────
    const user = await User.findById(decoded.userId).select('+posPinHash');
    if (!user || user.status !== 'active') {
      return res.status(401).json({ success: false, message: 'Staff not found or inactive' });
    }
    if (!user.tenant || user.tenant.toString() !== String(decoded.tenantId)) {
      return res.status(401).json({ success: false, message: 'Token tenant mismatch' });
    }
    req.posUser = user;
    req.user    = user;
    req.posPermissions = decoded.posPermissions || user.posPermissions || ['pos:sell'];

    const tenant = await Tenant.findById(user.tenant);
    if (!tenant || !tenant.isActive) {
      return res.status(401).json({ success: false, message: 'Tenant not found or inactive' });
    }
    req.tenant = tenant;
  } else {
    // ── Admin JWT path ───────────────────────────────────────────────────────
    const userId = decoded.userId || decoded.id;
    const user   = await User.findById(userId).select('_id email role tenant status firstName lastName');
    if (!user || user.status !== 'active') {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }
    req.user = user;
    req.posPermissions = [];

    if (user.tenant) {
      const tenant = await Tenant.findById(user.tenant);
      if (!tenant || !tenant.isActive) {
        return res.status(401).json({ success: false, message: 'Tenant not found or inactive' });
      }
      req.tenant = tenant;
    } else {
      req.tenant = null;
    }
  }

  next();
});

module.exports = { protectPOS, requirePOSPermission, protectPOSOrAdmin };

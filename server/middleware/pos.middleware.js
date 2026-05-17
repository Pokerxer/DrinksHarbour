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

module.exports = { protectPOS, requirePOSPermission };

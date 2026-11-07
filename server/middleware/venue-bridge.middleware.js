'use strict';
// middleware/venue-bridge.middleware.js — Bearer-token auth for the S4 device
// bridge endpoints (spec §2). Deliberately NOT the staff JWT chain: the bridge
// is a location-scoped PULL client whose token was minted server-side by the
// stations.write register route; only its sha-256 hash is stored on
// VenueLocationProfile.deviceBridge (never the raw token), and the server
// never connects outward — the bridge polls these endpoints. Comparisons are
// constant-time (crypto.timingSafeEqual). Status contract: 401 for a
// missing/wrong/REVOKED token, 404 for a wrong location (no profile document
// exists there), then req.bridge carries the resolved tenant/location scope.
const crypto = require('node:crypto');
const asyncHandler = require('../utils/asyncHandler');
const Profile = require('../models/VenueLocationProfile');
const { fail } = require('../services/venue/errors');
const { id } = require('../services/venue/eligibility');

function bridgeTokenHash(token) { return crypto.createHash('sha256').update(String(token)).digest('hex'); }

function hashesMatchHex(a, b) {
  const left = Buffer.from(String(a)); const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

const requireBridgeToken = asyncHandler(async (req, res, next) => {
  const header = req.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  const locationId = req.params.locationId;
  if (!/^[a-f\d]{24}$/i.test(locationId || '')) fail('NOT_FOUND', 'Location not found', 404);
  const profile = await Profile.findOne({ location: locationId }).select('tenant deviceBridge').lean();
  if (!profile) fail('NOT_FOUND', 'Location not found', 404);
  const stored = profile.deviceBridge && profile.deviceBridge.tokenHash;
  if (!token || !stored || !hashesMatchHex(bridgeTokenHash(token), stored)) fail('VENUE_UNAUTHORIZED', 'Invalid device bridge token', 401);
  req.bridge = { tenantId: id(profile.tenant), locationId };
  next();
});

module.exports = { requireBridgeToken, bridgeTokenHash };

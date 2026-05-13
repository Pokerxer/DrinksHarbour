// controllers/shipping.controller.js
const asyncHandler = require('express-async-handler');
const naija        = require('naija-state-local-government');
const {
  calculateShipping,
  calculateShippingByDistance,
  FREE_THRESHOLD,
  STATE_ZONES,
} = require('../data/shipping-zones');
const { getRoadDistanceKm, getRouteDistanceKm, WAREHOUSE } = require('../services/ors.service');

// Lazy-load Tenant to avoid circular deps at module init time
const getTenant = () => require('../models/Tenant');

// ── State normalisation helpers ───────────────────────────────────────────────

function normaliseStateName(state) {
  if (!state) return '';
  const s = state.trim();
  if (/federal capital territory|fct/i.test(s) || /abuja/i.test(s)) return 'FCT - Abuja';
  return s;
}

function resolvePackageState(state) {
  if (!state) return null;
  const s = state.trim().toLowerCase();
  if (['fct - abuja', 'fct', 'abuja', 'federal capital territory'].includes(s))
    return 'Federal Capital Territory';
  const all = naija.all();
  return (
    all.find(r => r.state.toLowerCase() === s) ||
    all.find(r => r.state.toLowerCase() === s.replace(/\s+state$/i, '').trim())
  )?.state || null;
}


/**
 * GET /api/shipping/calculate
 *
 * Query params:
 *   state    – customer state
 *   lga      – customer LGA
 *   subtotal – cart subtotal in NGN
 *   lat, lon – customer coordinates (enables distance-based pricing)
 *   vendors  – comma-separated tenant IDs (enables multi-vendor route pricing)
 *
 * Logic:
 *   1. If customer coords provided:
 *      a. Fetch vendor locations for same-state tenants
 *      b. If 2+ vendors with locations → route pricing (warehouse→v1→v2→customer)
 *      c. Otherwise → direct warehouse→customer distance pricing
 *   2. Fallback: zone/LGA-based pricing
 */
const getShippingRate = asyncHandler(async (req, res) => {
  const {
    state = '',
    lga = '',
    subtotal = '0',
    lat,
    lon,
    vendors = '',
  } = req.query;

  const sub         = parseFloat(subtotal) || 0;
  const customerLat = parseFloat(lat);
  const customerLon = parseFloat(lon);
  const hasCoords   = !isNaN(customerLat) && !isNaN(customerLon);
  const hasKey      = !!process.env.GOOGLE_PLACES_API_KEY;

  if (hasCoords && hasKey) {
    try {
      let distanceKm, stops = 0, routeType = 'direct';

      // ── Multi-vendor route ──────────────────────────────────────────────────
      const vendorIds = vendors
        ? vendors.split(',').map(v => v.trim()).filter(Boolean)
        : [];

      if (vendorIds.length >= 2) {
        const Tenant = getTenant();
        const customerNormState = normaliseStateName(state);

        // Fetch only same-state vendors that have coordinates — single DB query
        const tenants = await Tenant.find(
          {
            _id:             { $in: vendorIds },
            normalizedState: customerNormState,
            'location.lat':  { $ne: null },
            'location.lon':  { $ne: null },
          },
          { 'location.lat': 1, 'location.lon': 1 },
        ).lean();

        const vendorLocations = tenants
          .map(t => t.location)
          .filter(l => l?.lat && l?.lon);

        if (vendorLocations.length >= 1) {
          const route = await getRouteDistanceKm(vendorLocations, customerLat, customerLon);
          distanceKm = route.distanceKm;
          stops      = route.stops;
          routeType  = stops >= 2 ? 'multi-vendor' : stops === 1 ? 'single-vendor' : 'direct';
        }
      }

      // ── Single / fallback direct distance ─────────────────────────────────
      if (distanceKm == null) {
        distanceKm = await getRoadDistanceKm(customerLat, customerLon);
      }

      const result = calculateShippingByDistance(distanceKm, sub);

      return res.json({
        success: true,
        data: {
          ...result,
          freeThreshold: FREE_THRESHOLD,
          remaining:  result.isFree ? 0 : Math.max(0, FREE_THRESHOLD - sub),
          source:     'google',
          routeType,
          stops,
          warehouse:  { lat: WAREHOUSE.lat, lon: WAREHOUSE.lon },
        },
      });
    } catch (err) {
      console.warn('[Shipping] Google distance error, falling back to zone pricing:', err.message);
    }
  }

  // ── Zone / LGA fallback ───────────────────────────────────────────────────
  const result = calculateShipping(state, lga, sub);
  res.json({
    success: true,
    data: {
      ...result,
      freeThreshold: FREE_THRESHOLD,
      remaining: result.isFree ? 0 : Math.max(0, FREE_THRESHOLD - sub),
      source: 'zone',
    },
  });
});

/**
 * GET /api/shipping/lgas?state=X
 */
const getLGAs = asyncHandler(async (req, res) => {
  const { state = '' } = req.query;
  const pkgState = resolvePackageState(state);
  if (!pkgState) return res.json({ success: true, data: [] });
  try {
    const entry = naija.lgas(pkgState);
    res.json({ success: true, data: (entry?.lgas || []).slice().sort() });
  } catch {
    res.json({ success: true, data: [] });
  }
});

const getStates = asyncHandler(async (req, res) => {
  res.json({ success: true, data: naija.states().sort() });
});

const getZones = asyncHandler(async (req, res) => {
  res.json({ success: true, data: STATE_ZONES });
});

module.exports = { getShippingRate, getLGAs, getStates, getZones };

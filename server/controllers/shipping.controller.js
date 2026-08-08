// controllers/shipping.controller.js
const asyncHandler = require('express-async-handler');
const naija        = require('naija-state-local-government');
const {
  calculateShipping,
  calculateShippingByDistance,
  FREE_THRESHOLD,
  FREE_THRESHOLD_OUTSIDE,
  getFreeThreshold,
  STATE_ZONES,
} = require('../data/shipping-zones');
const { getRoadDistanceKm, getRouteDistanceKm, WAREHOUSE } = require('../services/ors.service');
const { resolveFirstOrderPerk } = require('../services/firstOrderPerk.service');
const { FIRST_ORDER_PERK } = require('../services/firstOrderPerk.helpers');

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
 * Fold the first-purchase delivery waiver into a quote.
 *
 * `fee` keeps its existing meaning — what the customer actually pays — so every
 * caller that already reads `fee`/`isFree` picks the waiver up for free. The
 * pre-waiver number is preserved as `baseFee`, which is what the order write
 * recomputes against; it must never recompute against the discounted figure or
 * the waiver would compound on itself.
 */
async function applyFirstOrderPerk(result, { user, subtotal, state }) {
  const baseFee = result.fee;

  const perk = await resolveFirstOrderPerk({ user, subtotal, state, baseFee });
  const fee  = perk.eligible ? perk.payableFee : baseFee;

  return {
    ...result,
    baseFee,
    fee,
    isFree: fee === 0,
    firstOrderPerk: {
      eligible:     perk.eligible,
      waivedAmount: perk.waivedAmount,
      reason:       perk.reason,
      minSubtotal:  perk.minSubtotal,
      maxWaiver:    perk.maxWaiver,
    },
  };
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

      const result = await applyFirstOrderPerk(
        calculateShippingByDistance(distanceKm, sub, state),
        { user: req.user, subtotal: sub, state },
      );
      const threshold = getFreeThreshold(state);

      return res.json({
        success: true,
        data: {
          ...result,
          freeThreshold: threshold,
          remaining:  result.isFree ? 0 : Math.max(0, threshold - sub),
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
  const result = await applyFirstOrderPerk(
    calculateShipping(state, lga, sub),
    { user: req.user, subtotal: sub, state },
  );
  const threshold = getFreeThreshold(state);
  res.json({
    success: true,
    data: {
      ...result,
      freeThreshold: threshold,
      remaining: result.isFree ? 0 : Math.max(0, threshold - sub),
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

/**
 * GET /api/shipping/first-order-perk
 *
 * Cheap eligibility probe for the marketing surfaces — the header bar and the
 * cart banner need to know whether to advertise the offer long before a delivery
 * address exists. No fee is quoted here, so `eligible` answers "would this
 * customer qualify once they enter an Abuja address", not "is a waiver applied".
 *
 * Optional query params `subtotal` and `state` sharpen the answer where the
 * caller knows them (the cart page knows the subtotal), which is what lets the
 * banner say "add ₦12,000 more" instead of a generic pitch.
 */
const getFirstOrderPerk = asyncHandler(async (req, res) => {
  const { subtotal, state } = req.query;

  // With no state supplied, assume the perk zone: the question being asked is
  // whether this customer is eligible at all, not where they happen to live.
  const perk = await resolveFirstOrderPerk({
    user:     req.user,
    subtotal: subtotal !== undefined ? parseFloat(subtotal) || 0 : FIRST_ORDER_PERK.minSubtotal,
    state:    state || FIRST_ORDER_PERK.states[0],
    baseFee:  null,
  });

  res.json({
    success: true,
    data: {
      ...perk,
      signedIn:        !!req.user,
      subtotalApplied: subtotal !== undefined,
    },
  });
});

module.exports = { getShippingRate, getLGAs, getStates, getZones, getFirstOrderPerk };

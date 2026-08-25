// services/posVenue.service.js
//
// Venue-mode gate for the POS restaurant endpoints. "Venue" is decided by the
// tenant's declared business type at approval time and stored as the same
// posSettings.isBarRestaurant flag the settings UI already toggles — one flag,
// two ways to set it, so resellers and venues are indistinguishable to every
// downstream reader.

const VENUE_BUSINESS_TYPES = ['Restaurant', 'Bar / Lounge', 'Nightclub / Club'];

/** True when this business type is auto-enabled for venue mode at approval. */
function isVenueBusinessType(businessType) {
  return VENUE_BUSINESS_TYPES.includes(businessType);
}

/**
 * Sends 400 and returns true when venue mode is off; returns false to pass.
 */
function venueBlocked(req, res) {
  if (req.tenant?.posSettings?.isBarRestaurant === true) return false;
  res.status(400).json({ success: false, message: 'venue mode disabled' });
  return true;
}

module.exports = { VENUE_BUSINESS_TYPES, isVenueBusinessType, venueBlocked };

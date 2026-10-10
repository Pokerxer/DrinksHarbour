'use strict';
const { onlyKeys } = require('./storefrontPricing');
const { ValidationError } = require('../utils/errors');
const { calculateShipping, calculateShippingByDistance, getFreeThreshold } = require('../data/shipping-zones');
const routing = require('./ors.service');
function validPosition(lat, lon) {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lon) && lon >= -180 && lon <= 180;
}
function validateShipping(body) {
  const method = body.shippingMethod || 'standard';
  if (!['standard', 'pickup'].includes(method)) throw new ValidationError('Unsupported shipping method');
  if (body.shipping != null) {
    onlyKeys(body.shipping, ['address', 'city', 'state', 'country', 'postalCode', 'lga', 'coordinates']);
    const coordinates = body.shipping.coordinates;
    if (coordinates != null) {
      onlyKeys(coordinates, ['latitude', 'longitude']);
      if (!validPosition(coordinates.latitude, coordinates.longitude)) throw new ValidationError('Invalid delivery coordinates');
    }
    for (const [field, value] of Object.entries(body.shipping)) {
      if (field !== 'coordinates' && (typeof value !== 'string' || value.length > 300)) throw new ValidationError(`Invalid shipping ${field}`);
    }
  }
  if (method === 'pickup') return method;
  if (!body.shipping || typeof body.shipping.state !== 'string' || !body.shipping.state.trim() || body.shipping.state.length > 80) throw new ValidationError('Shipping state is required');
  if (body.shipping.country && !['NG', 'Nigeria'].includes(body.shipping.country)) throw new ValidationError('Delivery supports Nigeria only');
  return method;
}
async function shippingQuote(body, subtotal, tenant = {}) {
  if (validateShipping(body) === 'pickup') return { fee: 0, zone: 'pickup', method: 'pickup', source: 'pickup', label: 'Collect from store', isFree: true };
  const shipping = body.shipping;
  const threshold = getFreeThreshold(shipping.state);
  const metadata = result => ({ ...result, freeThreshold: threshold, remaining: result.isFree ? 0 : Math.max(0, threshold - subtotal) });
  const location = tenant.location, address = tenant.address;
  const origin = validPosition(location?.lat, location?.lon)
    ? { lat: location.lat, lon: location.lon }
    : address?.street?.trim() && address?.city?.trim() && address?.state?.trim()
      ? { address: [address.street, address.lga, address.city, address.state, address.country || 'Nigeria'].filter(Boolean).join(', ') }
      : null;
  if (shipping.coordinates && origin) {
    try {
      const km = await routing.getRoadDistanceKm(shipping.coordinates.latitude, shipping.coordinates.longitude, origin);
      if (!Number.isFinite(km) || km < 0) throw new Error('Invalid delivery distance');
      return metadata({ ...calculateShippingByDistance(km, subtotal, shipping.state), source: 'google', routeType: 'direct' });
    } catch {
      // Provider failure uses the same published zone rates as manual addresses.
    }
  }
  return metadata({ ...calculateShipping(shipping.state, shipping.lga || shipping.city || '', subtotal), method: 'zone', source: 'zone' });
}
module.exports = { shippingQuote };
